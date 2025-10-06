# deepgram_live_es.py
import os, sys, signal
from dotenv import load_dotenv
import sounddevice as sd
from deepgram import DeepgramClient, LiveOptions, LiveTranscriptionEvents

SAMPLE_RATE = 16000
CHUNK_MS = 100
FRAMES_PER_CHUNK = SAMPLE_RATE * CHUNK_MS // 1000  # 1600

def main():
    load_dotenv()
    api_key = os.getenv("DEEPGRAM_API_KEY")
    if not api_key:
        print("Set DEEPGRAM_API_KEY in your env or .env", file=sys.stderr)
        sys.exit(1)

    dg = DeepgramClient(api_key=api_key)
    conn = dg.listen.websocket.v("1")

    # ---- Correct handler signatures (conn first) ----
    def on_open(conn, open, **kwargs):
        print("Deepgram: connection open.")

    def on_transcript(conn, result, **kwargs):
        alt = result.channel.alternatives[0]
        if not alt.transcript:
            return
        is_final = getattr(result, "is_final", False)
        print(("FINAL: " if is_final else "… ") + alt.transcript)

    def on_error(conn, error, **kwargs):
        print("Deepgram error:", error, file=sys.stderr)

    def on_close(conn, close, **kwargs):
        print("Deepgram: connection closed.")

    conn.on(LiveTranscriptionEvents.Open, on_open)
    conn.on(LiveTranscriptionEvents.Transcript, on_transcript)
    conn.on(LiveTranscriptionEvents.Error, on_error)
    conn.on(LiveTranscriptionEvents.Close, on_close)

    # A) Lock to Spanish (LatAm): nova-2 + es-419
    opts = LiveOptions(
        model="nova-2",
        language="es-419",
        punctuate=True,
        interim_results=True,
        encoding="linear16",
        channels=1,
        sample_rate=SAMPLE_RATE,
        vad_events=True,
        endpointing=300,   # ms of silence to end an utterance
    )

    conn.start(opts)

    stop = False
    def _sigint(*_):
        nonlocal stop; stop = True
    signal.signal(signal.SIGINT, _sigint)

    with sd.RawInputStream(samplerate=SAMPLE_RATE, channels=1, dtype="int16",
                           blocksize=FRAMES_PER_CHUNK) as stream:
        try:
            while not stop:
                data, _ = stream.read(FRAMES_PER_CHUNK)  # cffi buffer
                conn.send(bytes(data))                   # convert to bytes
        finally:
            conn.finish()

if __name__ == "__main__":
    main()
