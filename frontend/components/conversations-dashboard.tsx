"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  MessageCircle,
  Clock,
  User,
  Bot,
  Sparkles,
  Calendar,
  BarChart3,
  AlertCircle,
  Loader2,
  ArrowLeft,
  RefreshCw,
  Eye,
  MessageSquare,
  TrendingUp,
  Users,
  Timer,
} from "lucide-react"
import {
  getCompanySessions,
  getConversationHistory,
  getSessionSummary,
  type ConversationSession,
  type ConversationMessage,
} from "@/lib/conversations-api"
import { useLanguage } from "@/lib/language-context"

interface ConversationsDashboardProps {
  companyId: string
  companyName: string
}

export function ConversationsDashboard({ companyId, companyName }: ConversationsDashboardProps) {
  const { t } = useLanguage()
  const [sessions, setSessions] = useState<ConversationSession[]>([])
  const [selectedSession, setSelectedSession] = useState<ConversationSession | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [totalSessions, setTotalSessions] = useState(0)
  const [generatingSummaries, setGeneratingSummaries] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadSessions()
  }, [companyId])

  const loadSessions = async () => {
    try {
      setIsLoadingSessions(true)
      setError(null)

      // Load sessions without AI summaries for faster loading
      const response = await getCompanySessions(companyId, 50, 0, false)
      setSessions(response.sessions)
      setTotalSessions(response.total)
    } catch (error) {
      console.error("Error loading sessions:", error)
      setError(t('conversations.error'))
    } finally {
      setIsLoadingSessions(false)
    }
  }

  const loadConversationHistory = async (session: ConversationSession) => {
    try {
      setIsLoadingMessages(true)
      setSelectedSession(session)
      setIsDialogOpen(true)

      const response = await getConversationHistory(session.session_id)
      setMessages(response.messages)
    } catch (error) {
      console.error("Error loading conversation history:", error)
      setError(t('conversations.history.error'))
    } finally {
      setIsLoadingMessages(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatDuration = (minutes: number) => {
    if (minutes < 1) return "< 1 min"
    if (minutes < 60) return `${Math.round(minutes)} min`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = Math.round(minutes % 60)
    return `${hours}h ${remainingMinutes}m`
  }

  const generateAISummary = async (sessionId: string) => {
    try {
      setGeneratingSummaries(prev => new Set(prev).add(sessionId))
      setError(null)

      const response = await getSessionSummary(sessionId)
      
      // Update the session with the new summary
      const updatedSession = {
        summary: response.summary.summary,
        summary_source: "generated"
      }
      
      setSessions(prev => prev.map(session => 
        session.session_id === sessionId 
          ? { ...session, ...updatedSession }
          : session
      ))

      // Update selectedSession if it's the same session
      if (selectedSession && selectedSession.session_id === sessionId) {
        setSelectedSession(prev => prev ? { ...prev, ...updatedSession } : null)
      }

      console.log("AI summary generated for session:", sessionId)
    } catch (error) {
      console.error("Error generating AI summary:", error)
      setError("Error al generar el resumen de IA")
    } finally {
      setGeneratingSummaries(prev => {
        const newSet = new Set(prev)
        newSet.delete(sessionId)
        return newSet
      })
    }
  }

  const getSessionStats = () => {
    if (sessions.length === 0) return null

    const totalMessages = sessions.reduce((sum, session) => {
      const messages = session.statistics?.total_messages || 0
      return sum + messages
    }, 0)
    
    const totalDuration = sessions.reduce((sum, session) => {
      const duration = session.statistics?.duration_minutes || 0
      return sum + duration
    }, 0)
    
    const avgMessagesPerSession = Math.round(totalMessages / sessions.length)
    const avgDurationPerSession = Math.round(totalDuration / sessions.length)

    return {
      totalMessages,
      totalDuration,
      avgMessagesPerSession,
      avgDurationPerSession,
    }
  }

  const stats = getSessionStats()

  if (isLoadingSessions) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            <span className="ml-2 text-gray-500">{t('conversations.loading')}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                {t('conversations.company.title').replace('{COMPANY_NAME}', companyName)}
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">{t('conversations.company.subtitle')}</p>
            </div>
            <Button variant="outline" size="sm" onClick={loadSessions} disabled={isLoadingSessions}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingSessions ? "animate-spin" : ""}`} />
              {t('conversations.refresh')}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <MessageSquare className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">{t('conversations.stats.total')}</p>
                  <p className="text-2xl font-bold text-gray-900">{totalSessions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">{t('conversations.stats.totalMessages')}</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalMessages}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">{t('conversations.stats.avgMessages')}</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.avgMessagesPerSession}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Timer className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">{t('conversations.stats.avgDuration')}</p>
                  <p className="text-2xl font-bold text-gray-900">{formatDuration(stats.avgDurationPerSession)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sessions List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {t('conversations.sessions.title').replace('{TOTAL}', totalSessions.toString())}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>{t('conversations.sessions.none')}</p>
              <p className="text-sm">
                {t('conversations.sessions.none.desc')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <Card key={session.session_id} className="border-gray-200 hover:border-gray-300 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {session.session_id.substring(0, 8)}...
                          </Badge>
                          <div className="flex items-center space-x-1 text-sm text-gray-500">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(session.last_activity)}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="flex items-center space-x-1">
                            <MessageSquare className="h-3 w-3 text-blue-500" />
                            <span className="text-gray-600">{t('conversations.session.messages.count').replace('{COUNT}', (session.statistics?.total_messages || 0).toString())}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <User className="h-3 w-3 text-green-500" />
                            <span className="text-gray-600">{t('conversations.session.user.messages').replace('{COUNT}', (session.statistics?.user_messages || 0).toString())}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Sparkles className="h-3 w-3 text-purple-500" />
                            <span className="text-gray-600">{t('conversations.session.bot.messages').replace('{COUNT}', (session.statistics?.bot_messages || 0).toString())}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="h-3 w-3 text-orange-500" />
                            <span className="text-gray-600">{formatDuration(session.statistics?.duration_minutes || 0)}</span>
                          </div>
                        </div>

                        {session.summary && (
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-sm text-gray-700 line-clamp-3">{session.summary}</p>
                            {session.summary_source && (
                              <Badge variant="secondary" className="mt-2 text-xs">
                                {t('conversations.session.summary')} {session.summary_source === "existing" ? t('conversations.session.summary.existing') : t('conversations.session.summary.generated')}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col space-y-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadConversationHistory(session)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {t('conversations.session.view.button')}
                        </Button>
                        
                        {!session.summary ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generateAISummary(session.session_id)}
                            disabled={generatingSummaries.has(session.session_id)}
                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                          >
                            {generatingSummaries.has(session.session_id) ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <MessageSquare className="h-4 w-4 mr-1" />
                            )}
                            {generatingSummaries.has(session.session_id) ? "Generando..." : "Resumen IA"}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generateAISummary(session.session_id)}
                            disabled={generatingSummaries.has(session.session_id)}
                            className="text-green-600 border-green-200 hover:bg-green-50"
                          >
                            {generatingSummaries.has(session.session_id) ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4 mr-1" />
                            )}
                            {generatingSummaries.has(session.session_id) ? "Regenerando..." : "Regenerar IA"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversation Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              {t('conversations.session.id').replace('{SESSION_ID}', selectedSession?.session_id.substring(0, 8) || '')}
            </DialogTitle>
            {selectedSession && (
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center space-x-1">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(selectedSession.last_activity)}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <MessageSquare className="h-3 w-3" />
                  <span>{t('conversations.session.messages.count').replace('{COUNT}', (selectedSession.statistics?.total_messages || 0).toString())}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatDuration(selectedSession.statistics?.duration_minutes || 0)}</span>
                </div>
              </div>
            )}
          </DialogHeader>

          <div className="space-y-4">
            {selectedSession && (selectedSession.summary ? (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-blue-900">{t('conversations.session.summary')}</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateAISummary(selectedSession.session_id)}
                      disabled={generatingSummaries.has(selectedSession.session_id)}
                      className="text-green-600 border-green-200 hover:bg-green-50"
                    >
                      {generatingSummaries.has(selectedSession.session_id) ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-1" />
                      )}
                      {generatingSummaries.has(selectedSession.session_id) ? "Regenerando..." : "Regenerar"}
                    </Button>
                  </div>
                  <p className="text-sm text-blue-800">{selectedSession.summary}</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-gray-50 border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Sin Resumen</h4>
                      <p className="text-sm text-gray-600">Esta conversación no tiene un resumen de IA</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateAISummary(selectedSession.session_id)}
                      disabled={generatingSummaries.has(selectedSession.session_id)}
                      className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      {generatingSummaries.has(selectedSession.session_id) ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <MessageSquare className="h-4 w-4 mr-1" />
                      )}
                      {generatingSummaries.has(selectedSession.session_id) ? "Generando..." : "Generar Resumen IA"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Separator />

            <ScrollArea className="h-96">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                  <span className="ml-2 text-gray-500">{t('conversations.messages.loading')}</span>
                </div>
              ) : (
                <div className="space-y-4 pr-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex items-start space-x-3 ${
                        message.message_type === "bot" ? "" : "flex-row-reverse space-x-reverse"
                      }`}
                    >
                      <div
                        className={`p-2 rounded-xl ${message.message_type === "bot" ? "bg-purple-100" : "bg-blue-100"}`}
                      >
                        {message.message_type === "bot" ? (
                          <Sparkles className="h-4 w-4 text-purple-600" />
                        ) : (
                          <User className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <div className={`flex-1 ${message.message_type === "bot" ? "text-left" : "text-right"}`}>
                        <div
                          className={`inline-block max-w-xs lg:max-w-md xl:max-w-lg p-3 rounded-xl ${
                            message.message_type === "bot" ? "bg-gray-100 text-gray-800" : "bg-blue-500 text-white"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <p className="text-xs text-gray-400">{formatDate(message.timestamp)}</p>
                          {message.metadata.input_type && (
                            <Badge variant="outline" className="text-xs">
                              {message.metadata.input_type}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('conversations.session.close')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
