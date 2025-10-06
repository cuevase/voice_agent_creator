import os, sys, signal
from dotenv import load_dotenv
import assemblyai as aai
from assemblyai.streaming.v3 import (
    StreamingClient, StreamingClientOptions, StreamingParameters,
    StreamingEvents, BeginEvent, TurnEvent, TerminationEvent, StreamingError,
    StreamingSessionParameters
)
import sounddevice as sd

print("Using assemblyai from:", getattr(aai, "__file__", None))

load_dotenv()
API_KEY = os.getenv("ASSEMBLYAI_API_KEY")
if not API_KEY:
    print("Set ASSEMBLYAI_API_KEY in your env or .env", file=sys.stderr)
    sys.exit(1)

SAMPLE_RATE = 16000
CHUNK_MS = 100
FRAMES_PER_CHUNK = SAMPLE_RATE * CHUNK_MS // 1000  # 1600 frames

def mic_chunks():
    with sd.RawInputStream(
        samplerate=SAMPLE_RATE, channels=1, dtype="int16",
        blocksize=FRAMES_PER_CHUNK
    ) as stream:
        while True:
            data, _ = stream.read(FRAMES_PER_CHUNK)  # bytes
            yield bytes(data)

def on_begin(self, e: BeginEvent):
    print("Session started:", e.id)

def on_turn(self, e: TurnEvent):
    print(e.transcript, "(end)" if e.end_of_turn else "")
    if e.end_of_turn and not e.turn_is_formatted:
        self.set_params(StreamingSessionParameters(format_turns=True))

def on_term(self, e: TerminationEvent):
    print("Session terminated. Audio seconds:", e.audio_duration_seconds)

def on_err(self, err: StreamingError):
    print("Error:", err, file=sys.stderr)

def main():
    client = StreamingClient(StreamingClientOptions(api_key=API_KEY))
    client.on(StreamingEvents.Begin, on_begin)
    client.on(StreamingEvents.Turn, on_turn)
    client.on(StreamingEvents.Termination, on_term)
    client.on(StreamingEvents.Error, on_err)

    client.connect(StreamingParameters(sample_rate=SAMPLE_RATE, format_turns=True))

    stop = False
    def _sigint(*_): 
        nonlocal stop; stop = True
    signal.signal(signal.SIGINT, _sigint)

    gen = mic_chunks()
    try:
        for _ in client.stream(gen):
            if stop: break
    finally:
        client.disconnect(terminate=True)

if __name__ == "__main__":
    main()
