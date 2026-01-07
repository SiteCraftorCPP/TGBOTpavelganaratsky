import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, CalendarIcon, Clock, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Slot {
  id: string;
  date: string;
  time: string;
  status: "free" | "booked";
  client_id: string | null;
  comment: string | null;
  format: "online" | "offline" | null;
  available_formats: "offline" | "online" | "both";
  clients?: {
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    telegram_id: number;
  } | null;
}

const SlotsManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [newSlotTime, setNewSlotTime] = useState("10:00");
  const [newSlotFormats, setNewSlotFormats] = useState<"offline" | "online" | "both">("both");

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ["slots"],
    queryFn: async () => {
      // Get date from 24 hours ago
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 1);
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from("slots")
        .select(`
          *,
          clients (
            first_name,
            last_name,
            username,
            telegram_id
          )
        `)
        .gte("date", cutoffDateStr)
        .order("date", { ascending: true })
        .order("time", { ascending: true });

      if (error) throw error;
      return data as Slot[];
    },
  });

  const createSlotMutation = useMutation({
    mutationFn: async ({ date, time, available_formats }: { date: string; time: string; available_formats: string }) => {
      const { error } = await supabase.from("slots").insert({ date, time, available_formats });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slots"] });
      toast({ title: "Слот создан" });
    },
    onError: (error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const deleteSlotMutation = useMutation({
    mutationFn: async (slotId: string) => {
      const { error } = await supabase.from("slots").delete().eq("id", slotId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slots"] });
      toast({ title: "Слот удалён" });
    },
    onError: (error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const cancelBookingMutation = useMutation({
    mutationFn: async (slotId: string) => {
      const { data, error } = await supabase.functions.invoke("cancel-booking-admin", {
        body: { slotId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slots"] });
      toast({ title: "Запись отменена", description: "Клиент получил уведомление" });
    },
    onError: (error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateSlot = () => {
    if (!selectedDate) return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    createSlotMutation.mutate({ date: dateStr, time: newSlotTime, available_formats: newSlotFormats });
  };

  const timeOptions = [];
  for (let h = 8; h <= 20; h++) {
    timeOptions.push(`${h.toString().padStart(2, "0")}:00`);
    if (h < 20) timeOptions.push(`${h.toString().padStart(2, "0")}:30`);
  }

  // Group slots by date
  const slotsByDate = slots.reduce((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    acc[slot.date].push(slot);
    return acc;
  }, {} as Record<string, Slot[]>);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Create Slot */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Добавить слот
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Дата</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal mt-1">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP", { locale: ru }) : "Выберите дату"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  locale={ru}
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>Время</Label>
            <Select value={newSlotTime} onValueChange={setNewSlotTime}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeOptions.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Формат консультации</Label>
            <Select value={newSlotFormats} onValueChange={(v) => setNewSlotFormats(v as "offline" | "online" | "both")}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">🏠💻 Очно и онлайн</SelectItem>
                <SelectItem value="offline">🏠 Только очно</SelectItem>
                <SelectItem value="online">💻 Только онлайн</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={handleCreateSlot} 
            className="w-full" 
            disabled={!selectedDate || createSlotMutation.isPending}
          >
            <Plus className="mr-2 h-4 w-4" />
            Создать слот
          </Button>
        </CardContent>
      </Card>

      {/* Slots List */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Расписание
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Загрузка...</p>
          ) : Object.keys(slotsByDate).length === 0 ? (
            <p className="text-muted-foreground">Нет слотов</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(slotsByDate).map(([date, daySlots]) => (
                <div key={date}>
                  <h3 className="font-medium text-foreground mb-3">
                    {format(new Date(date), "EEEE, d MMMM", { locale: ru })}
                  </h3>
                  <div className="space-y-2">
                    {daySlots.map((slot) => {
                      const fullName = [slot.clients?.first_name, slot.clients?.last_name]
                        .filter(Boolean)
                        .join(" ") || slot.clients?.username || "Клиент";
                      const telegramLink = slot.clients?.telegram_id 
                        ? `https://t.me/${slot.clients.username || ''}`.replace('https://t.me/', `tg://user?id=${slot.clients.telegram_id}`)
                        : null;
                      const formatLabel = slot.format === "online" ? "💻" : "🏠";

                      return (
                        <div
                          key={slot.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-medium">{slot.time.slice(0, 5)}</span>
                            {slot.status === "booked" ? (
                              <>
                                <Badge variant="secondary" className="flex items-center gap-1">
                                  {formatLabel} {fullName}
                                </Badge>
                                {slot.clients?.telegram_id && (
                                  <a
                                    href={`https://t.me/${slot.clients.username || ''}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:text-primary/80 transition-colors"
                                    title="Открыть чат в Telegram"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                )}
                              </>
                            ) : (
                              <>
                                <Badge variant="outline" className="text-success border-success">
                                  Свободно
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {slot.available_formats === "both" ? "🏠💻" : slot.available_formats === "offline" ? "🏠" : "💻"}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {slot.status === "booked" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => cancelBookingMutation.mutate(slot.id)}
                                disabled={cancelBookingMutation.isPending}
                                title="Отменить запись"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                            {slot.status === "free" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteSlotMutation.mutate(slot.id)}
                                disabled={deleteSlotMutation.isPending}
                                title="Удалить слот"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SlotsManager;
