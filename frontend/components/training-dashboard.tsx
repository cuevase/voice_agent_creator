"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

import {
  MessageCircle,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle,
  Trash2,
  Play,
  Clock,
  User,
  Bot,
  Send,
} from "lucide-react"
import {
  createTrainingSession,
  getTrainingSessions,
  deleteTrainingSession,
  createTrainingMessage,
  getTrainingMessages,
  getTrainingResponse,
  type TrainingSession,
  type TrainingMessage,
} from "@/lib/api"
import { useLanguage } from "@/lib/language-context"

interface TrainingDashboardProps {
  companyId: string
  companyName: string
}

export function TrainingDashboard({ companyId, companyName }: TrainingDashboardProps) {
  const { t } = useLanguage()
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null)
  const [messages, setMessages] = useState<TrainingMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [sendingMessage, setSendingMessage] = useState(false)
  const [lastSentMessage, setLastSentMessage] = useState("")
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    session_name: "",
  })
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isProcessingMessage, setIsProcessingMessage] = useState(false)
  const [processingMessageId, setProcessingMessageId] = useState<string | null>(null)
  const [isThinking, setIsThinking] = useState(false)

  useEffect(() => {
    loadSessions()
  }, [companyId])

  const loadSessions = async () => {
    try {
      setLoadingSessions(true)
      setError(null)
      const sessionsData = await getTrainingSessions(companyId)
      setSessions(sessionsData)
    } catch (error) {
      console.error("Error loading training sessions:", error)
      setError("Error al cargar las sesiones de entrenamiento")
    } finally {
      setLoadingSessions(false)
    }
  }

  const loadMessages = async (sessionId: string) => {
    try {
      setLoadingMessages(true)
      setError(null)
      console.log("=== STEP 4: Loading All Messages ===")
      console.log("API Call: GET /training/messages/{session_id}")
      console.log("Session ID:", sessionId)
      const messagesData = await getTrainingMessages(sessionId)
      console.log("GET /training/messages response:", messagesData)
      console.log("Total messages received:", messagesData.length)
      
      // Sort by creation time to ensure proper order
      const sortedMessages = messagesData.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      
      console.log("Messages count:", sortedMessages.length)
      console.log("Final messages after sorting:", sortedMessages.map(m => ({
        id: m.id,
        type: m.message_type,
        content: m.content.substring(0, 50) + '...',
        created_at: m.created_at
      })))
      setMessages(sortedMessages)
    } catch (error) {
      console.error("Error loading training messages:", error)
      setError("Error al cargar los mensajes de entrenamiento")
    } finally {
      setLoadingMessages(false)
    }
  }

  const handleCreateSession = async () => {
    if (!formData.session_name.trim()) {
      setError("Por favor ingresa un nombre para la sesión")
      return
    }

    try {
      setLoading(true)
      setError(null)

      const result = await createTrainingSession({
        company_id: companyId,
        session_name: formData.session_name.trim(),
      })

      if (result.success) {
        setSuccess("¡Sesión de entrenamiento creada exitosamente!")
        setFormData({ session_name: "" })
        setShowCreateForm(false)
        await loadSessions()

        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError("Error al crear la sesión de entrenamiento")
      }
    } catch (error) {
      console.error("Error creating training session:", error)
      setError("Error al crear la sesión de entrenamiento")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    try {
      setLoading(true)
      setError(null)

      const result = await deleteTrainingSession(sessionId)

      if (result.success) {
        setSuccess("¡Sesión eliminada exitosamente!")
        await loadSessions()

        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError("Error al eliminar la sesión")
      }
    } catch (error) {
      console.error("Error deleting training session:", error)
      setError("Error al eliminar la sesión")
    } finally {
      setLoading(false)
    }
  }

  const handleOpenConversation = async (session: TrainingSession) => {
    setSelectedSession(session)
    setActiveSessionId(session.id)
    await loadMessages(session.id)
  }

  const handleCloseConversation = () => {
    setSelectedSession(null)
    setActiveSessionId(null)
    setMessages([])
    setNewMessage("")
  }

  const handleSendMessage = useCallback(async () => {
    const startTime = Date.now()
    const userMessageContent = newMessage.trim()
    const messageId = `${userMessageContent}-${startTime}`
    
    console.log("=== TRAINING MESSAGE SEND START ===")
    console.log("Timestamp:", new Date(startTime).toISOString())
    console.log("Message ID:", messageId)
    console.log("handleSendMessage called", { 
      hasMessage: !!userMessageContent, 
      hasSession: !!selectedSession, 
      sendingMessage, 
      isProcessingMessage,
      processingMessageId,
      messageId
    })
    
    if (!userMessageContent || !selectedSession || sendingMessage || isProcessingMessage) {
      console.log("handleSendMessage early return")
      return
    }

    // Prevent duplicate messages
    if (lastSentMessage === userMessageContent || processingMessageId === messageId) {
      console.log("handleSendMessage duplicate message prevented")
      return
    }

    try {
      console.log("handleSendMessage starting processing")
      setSendingMessage(true)
      setIsProcessingMessage(true)
      setProcessingMessageId(messageId)
      setError(null)
      setLastSentMessage(userMessageContent)
      setNewMessage("") // Clear input immediately to prevent double sends

      // Optimistically add user message to UI immediately
      const optimisticUserMessage = {
        id: `temp-${Date.now()}`,
        training_session_id: selectedSession.id,
        message_type: "user" as const,
        content: userMessageContent,
        message_order: messages.length + 1,
        created_at: new Date().toISOString()
      }
      setMessages(prev => [...prev, optimisticUserMessage])

      // Show thinking state
      setIsThinking(true)

      // Add user message to backend
      console.log("=== STEP 1: Creating User Message ===")
      console.log("API Call: POST /training/messages")
      console.log("Payload:", {
        training_session_id: selectedSession.id,
        message_type: "user",
        content: userMessageContent,
      })
      const userMessageResult = await createTrainingMessage({
        training_session_id: selectedSession.id,
        message_type: "user",
        content: userMessageContent,
      })
      console.log("User message API response:", userMessageResult)

      // Get AI response
      console.log("=== STEP 2: Getting AI Response ===")
      console.log("API Call: POST /training/respond")
      console.log("URL params:", {
        session_id: selectedSession.id,
        user_message: userMessageContent,
      })
      const response = await getTrainingResponse(selectedSession.id, userMessageContent)
      console.log("AI response API response:", response)

      if (response.success) {
        // Add AI response
        console.log("=== STEP 3: Creating AI Message ===")
        console.log("API Call: POST /training/messages")
        console.log("Payload:", {
          training_session_id: selectedSession.id,
          message_type: "agent",
          content: response.response,
        })
        const aiMessageResult = await createTrainingMessage({
          training_session_id: selectedSession.id,
          message_type: "agent",
          content: response.response,
        })
        console.log("AI message API response:", aiMessageResult)
        
        // Optimistically add AI message to UI immediately
        const optimisticAIMessage = {
          id: `temp-ai-${Date.now()}`,
          training_session_id: selectedSession.id,
          message_type: "agent" as const,
          content: response.response,
          message_order: messages.length + 2, // +2 because we already added user message
          created_at: new Date().toISOString()
        }
        setMessages(prev => [...prev, optimisticAIMessage])
      } else {
        console.error("AI response failed:", response)
      }

      // Hide thinking state
      setIsThinking(false)

      // Wait a bit for backend to process, then refresh messages
      console.log("Waiting for backend to process messages...")
      await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
      
      // Refresh messages to get the real data from backend
      console.log("Loading messages")
      await loadMessages(selectedSession.id)
      const endTime = Date.now()
      const duration = endTime - startTime
      console.log("=== TRAINING MESSAGE SEND COMPLETE ===")
      console.log("Total duration:", duration + "ms")
      console.log("handleSendMessage completed successfully")
    } catch (error) {
      console.error("=== TRAINING MESSAGE SEND ERROR ===")
      console.error("Error sending training message:", error)
      setError("Error al enviar el mensaje")
      // Restore the message if there was an error
      setNewMessage(userMessageContent)
      setLastSentMessage("")
      // Remove optimistic messages and hide thinking state
      setMessages(prev => prev.filter(m => !m.id.startsWith('temp-')))
      setIsThinking(false)
    } finally {
      console.log("=== TRAINING MESSAGE SEND CLEANUP ===")
      console.log("handleSendMessage cleanup")
      setSendingMessage(false)
      setIsProcessingMessage(false)
      setProcessingMessageId(null)
    }
  }, [newMessage, selectedSession, sendingMessage, isProcessingMessage, lastSentMessage, processingMessageId, loadMessages, messages])

  if (loadingSessions) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <span className="ml-2 text-gray-500">Cargando sesiones de entrenamiento...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('training.title')}</h2>
          <p className="text-gray-600 mt-1">{t('training.subtitle')}</p>
        </div>
        {sessions.length > 0 && (
          <Button 
            onClick={() => setShowCreateForm(true)}
            className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('training.create.session')}
          </Button>
        )}
      </div>

      {/* Create Session Form */}
      {showCreateForm && (
        <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-purple-100/50 rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-b border-purple-100/50 pb-6">
            <CardTitle className="flex items-center gap-3 text-gray-900">
              <div className="p-2 bg-purple-100 rounded-xl">
                <Plus className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{t('training.create.session')}</h3>
                <p className="text-sm text-gray-500 font-normal">Crea tu primera sesión de entrenamiento para tu agente de IA</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="session_name">{t('training.session.name')}</Label>
                <Input
                  id="session_name"
                  placeholder={t('training.session.name.placeholder')}
                  value={formData.session_name}
                  onChange={(e) => setFormData({ ...formData, session_name: e.target.value })}
                />
              </div>
              <div className="flex space-x-2">
                <Button onClick={handleCreateSession} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('training.session.creating')}
                    </>
                  ) : (
                    t('training.session.create')
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Training Sessions */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t('training.sessions.title')}</h3>
        
        {sessions.length === 0 ? (
          <div className="space-y-6">
            <Card className="border-dashed border-2 border-gray-200 bg-gray-50">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageCircle className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">{t('training.session.no.sessions')}</h3>
                <p className="text-gray-600 text-center mb-6 max-w-md">
                  {t('training.session.no.sessions.desc')}
                </p>
                <Button 
                  onClick={() => setShowCreateForm(true)}
                  className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('training.create.session')}
                </Button>
              </CardContent>
            </Card>
            
            {/* Show the form directly when no sessions exist */}
            {showCreateForm && (
              <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-purple-100/50 rounded-2xl overflow-hidden">
                <CardHeader className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-b border-purple-100/50 pb-6">
                  <CardTitle className="flex items-center gap-3 text-gray-900">
                    <div className="p-2 bg-purple-100 rounded-xl">
                      <Plus className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{t('training.create.session')}</h3>
                      <p className="text-sm text-gray-500 font-normal">Crea tu primera sesión de entrenamiento para tu agente de IA</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="session_name">{t('training.session.name')}</Label>
                      <Input
                        id="session_name"
                        placeholder={t('training.session.name.placeholder')}
                        value={formData.session_name}
                        onChange={(e) => setFormData({ ...formData, session_name: e.target.value })}
                      />
                    </div>
                    <div className="flex space-x-2">
                      <Button onClick={handleCreateSession} disabled={loading}>
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {t('training.session.creating')}
                          </>
                        ) : (
                          t('training.session.create')
                        )}
                      </Button>
                      <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session) => (
              <Card key={session.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="bg-purple-100 p-2 rounded-full">
                        <MessageCircle className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{session.session_name}</h4>
                        <div className="flex items-center space-x-1 text-sm text-gray-500 mt-1">
                          <Clock className="h-3 w-3" />
                          <span>{session.total_messages} {t('training.session.total.messages')}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date(session.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <Badge variant="default" className="bg-purple-100 text-purple-800">
                      {t('training.status.active')}
                    </Badge>
                  </div>
                  
                  <div className="flex space-x-2 mt-4">
                    <Button
                      size="sm"
                      onClick={() => handleOpenConversation(session)}
                      className="flex-1 bg-purple-600 hover:bg-purple-700"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Entrenar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteSession(session.id)}
                      disabled={loading}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Training Conversation - Inline Display */}
      {activeSessionId && selectedSession && (
        <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-purple-100/50 rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-b border-purple-100/50 pb-6">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3 text-gray-900">
                <div className="p-2 bg-purple-100 rounded-xl">
                  <MessageCircle className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{selectedSession.session_name} - {t('training.conversation.title')}</h3>
                  <p className="text-sm text-gray-500 font-normal">Entrena tu agente de IA con esta conversación</p>
                </div>
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCloseConversation}
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cerrar
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Messages */}
              <div className="space-y-4 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4 bg-gray-50">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                    <span className="ml-2 text-gray-500">Cargando mensajes...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>{t('training.conversation.no.messages')}</p>
                    <p className="text-sm">{t('training.conversation.no.messages.desc')}</p>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.message_type === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                            message.message_type === 'user'
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <div className="flex items-center space-x-2 mb-1">
                            {message.message_type === 'user' ? (
                              <User className="h-3 w-3" />
                            ) : (
                              <Bot className="h-3 w-3" />
                            )}
                            <span className="text-xs font-medium">
                              {message.message_type === 'user' ? t('training.conversation.user') : t('training.conversation.agent')}
                            </span>
                          </div>
                          <p className="text-sm">{message.content}</p>
                        </div>
                      </div>
                    ))}
                    
                    {/* Thinking bubble */}
                    {isThinking && (
                      <div className="flex justify-start">
                        <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-gray-100 text-gray-900">
                          <div className="flex items-center space-x-2 mb-1">
                            <Bot className="h-3 w-3" />
                            <span className="text-xs font-medium">{t('training.conversation.agent')}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                            <span className="text-sm text-gray-500 ml-2">Pensando...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <Separator />

              {/* Message Input */}
              <div className="flex space-x-2">
                <Input
                  placeholder={t('training.conversation.message.placeholder')}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !sendingMessage && !isProcessingMessage && newMessage.trim()) {
                      e.preventDefault()
                      e.stopPropagation()
                      handleSendMessage()
                    }
                  }}
                  disabled={sendingMessage || isProcessingMessage}
                  className="flex-1"
                />
                <Button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleSendMessage()
                  }}
                  disabled={sendingMessage || isProcessingMessage || !newMessage.trim()}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {sendingMessage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 