import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Check, Eye, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface SosRequest {
  id: string;
  text: string | null;
  status: "new" | "viewed";
  created_at: string;
  clients: {
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    telegram_id: number;
  } | null;
}

const SosRequests = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["sos_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sos_requests")
        .select(`
          *,
          clients (
            first_name,
            last_name,
            username,
            telegram_id
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as SosRequest[];
    },
  });

  const markAsViewedMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from("sos_requests")
        .update({ status: "viewed" })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sos_requests"] });
      toast({ title: "Отмечено как просмотренное" });
    },
  });

  const getClientName = (client: SosRequest["clients"]) => {
    if (!client) return "Неизвестный";
    if (client.first_name || client.last_name) {
      return [client.first_name, client.last_name].filter(Boolean).join(" ");
    }
    if (client.username) return `@${client.username}`;
    return `ID: ${client.telegram_id}`;
  };

  const newRequests = requests.filter((r) => r.status === "new");
  const viewedRequests = requests.filter((r) => r.status === "viewed");

  return (
    <div className="space-y-6">
      {/* New Requests */}
      <Card className="rounded-none sm:rounded-lg border-0 sm:border">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${newRequests.length > 0 ? "text-destructive" : ""}`} />
            Новые SOS ({newRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {isLoading ? (
            <p className="text-muted-foreground">Загрузка...</p>
          ) : newRequests.length === 0 ? (
            <p className="text-muted-foreground">Нет новых запросов</p>
          ) : (
            <div className="space-y-4">
              {newRequests.map((request) => (
                <div
                  key={request.id}
                  className="p-4 rounded-lg border border-destructive/50 bg-destructive/5 overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 w-full">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="font-medium text-foreground break-words">
                          {getClientName(request.clients)}
                        </span>
                        <Badge variant="destructive" className="shrink-0">Новый</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {format(new Date(request.created_at), "d MMM yyyy, HH:mm", { locale: ru })}
                      </p>
                      {request.text && (
                        <p className="text-foreground whitespace-pre-wrap break-words">{request.text}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 w-full sm:w-auto sm:min-w-[120px] shrink-0">
                      {request.clients?.telegram_id && (
                        <Button size="sm" variant="outline" className="w-full" asChild>
                          <a
                            href={`https://t.me/${request.clients.username || request.clients.telegram_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageCircle className="mr-2 h-4 w-4" />
                            Написать
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => markAsViewedMutation.mutate(request.id)}
                        disabled={markAsViewedMutation.isPending}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Отметить
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Viewed Requests */}
      <Card className="rounded-none sm:rounded-lg">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            История ({viewedRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {viewedRequests.length === 0 ? (
            <p className="text-muted-foreground">Нет истории</p>
          ) : (
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {viewedRequests.map((request) => (
                  <div
                    key={request.id}
                    className="p-3 rounded-lg border border-border bg-card"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">
                          {getClientName(request.clients)}
                        </span>
                        {request.clients?.telegram_id && (
                          <Button size="icon" variant="ghost" className="h-6 w-6" asChild>
                            <a
                              href={`https://t.me/${request.clients.username || request.clients.telegram_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(request.created_at), "d MMM, HH:mm", { locale: ru })}
                      </span>
                    </div>
                    {request.text && (
                      <p className="text-sm text-muted-foreground break-words">{request.text}</p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SosRequests;
