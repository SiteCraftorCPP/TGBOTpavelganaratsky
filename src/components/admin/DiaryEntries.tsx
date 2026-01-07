import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface DiaryEntry {
  id: string;
  text: string;
  created_at: string;
  clients: {
    first_name: string | null;
    last_name: string | null;
    username: string | null;
  } | null;
}

const DiaryEntries = () => {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["diary_entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diary_entries")
        .select(`
          *,
          clients (
            first_name,
            last_name,
            username
          )
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as DiaryEntry[];
    },
  });

  const getClientName = (client: DiaryEntry["clients"]) => {
    if (!client) return "Неизвестный";
    if (client.first_name || client.last_name) {
      return [client.first_name, client.last_name].filter(Boolean).join(" ");
    }
    if (client.username) return `@${client.username}`;
    return "Клиент";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Дневники ({entries.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Загрузка...</p>
        ) : entries.length === 0 ? (
          <p className="text-muted-foreground">Нет записей</p>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="p-4 rounded-lg border border-border bg-card"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-foreground">
                      {getClientName(entry.clients)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(entry.created_at), "d MMM, HH:mm", { locale: ru })}
                    </span>
                  </div>
                  <p className="text-foreground whitespace-pre-wrap">{entry.text}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default DiaryEntries;
