import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, MessageCircle, Calendar, Pencil, Check, X, CalendarPlus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Client {
  id: string;
  telegram_id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  created_at: string;
  bookings?: { count: number }[];
  diary_entries?: { count: number }[];
}

const ClientsList = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");

  // Booking dialog state
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [bookingDate, setBookingDate] = useState<Date | undefined>(undefined);
  const [bookingTime, setBookingTime] = useState("");
  const [bookingFormat, setBookingFormat] = useState<"online" | "offline">("offline");

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const data = await api.getClients();
      // Transform data to match expected format
      return data.map((client: any) => ({
        ...client,
        bookings: [{ count: client.bookings_count || 0 }],
        diary_entries: [{ count: client.diary_count || 0 }],
      })) as Client[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, first_name, last_name }: { id: string; first_name: string; last_name: string }) => {
      await api.updateClient(id, {
        first_name: first_name.trim() || null,
        last_name: last_name.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["slots"] });
      toast.success("Имя обновлено");
      setEditingId(null);
    },
    onError: () => {
      toast.error("Ошибка обновления");
    },
  });

  const bookForClientMutation = useMutation({
    mutationFn: async ({ clientId, date, time, format }: { clientId: string; date: string; time: string; format: string }) => {
      const response = await fetch('https://liftme.by/book-for-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, date, time, format })
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to book');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["slots"] });
      toast.success("Консультация назначена, клиент уведомлён");
      closeBookingDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Ошибка назначения консультации");
    },
  });

  const startEdit = (client: Client) => {
    setEditingId(client.id);
    setEditFirstName(client.first_name || "");
    setEditLastName(client.last_name || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFirstName("");
    setEditLastName("");
  };

  const saveEdit = (id: string) => {
    updateMutation.mutate({ id, first_name: editFirstName, last_name: editLastName });
  };

  const openBookingDialog = (client: Client) => {
    setSelectedClient(client);
    setBookingDate(undefined);
    setBookingTime("");
    setBookingFormat("offline");
    setBookingDialogOpen(true);
  };

  const closeBookingDialog = () => {
    setBookingDialogOpen(false);
    setSelectedClient(null);
    setBookingDate(undefined);
    setBookingTime("");
    setBookingFormat("offline");
  };

  const handleBookForClient = () => {
    if (!selectedClient || !bookingDate || !bookingTime) {
      toast.error("Выберите дату и время");
      return;
    }
    const dateStr = format(bookingDate, "yyyy-MM-dd");
    bookForClientMutation.mutate({
      clientId: selectedClient.id,
      date: dateStr,
      time: bookingTime,
      format: bookingFormat
    });
  };

  const timeSlots = [
    "09:00", "10:00", "11:00", "12:00", "13:00", "14:00",
    "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"
  ];

  const getClientName = (client: Client) => {
    if (client.first_name || client.last_name) {
      return [client.first_name, client.last_name].filter(Boolean).join(" ");
    }
    if (client.username) return `@${client.username}`;
    return `ID: ${client.telegram_id}`;
  };

  const deleteClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      await api.deleteClient(clientId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["slots"] });
      toast.success("Клиент удалён");
    },
    onError: () => {
      toast.error("Ошибка удаления");
    },
  });

  return (
    <Card className="rounded-none sm:rounded-lg">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Клиенты ({clients.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        {isLoading ? (
          <p className="text-muted-foreground">Загрузка...</p>
        ) : clients.length === 0 ? (
          <p className="text-muted-foreground">Нет клиентов</p>
        ) : (
          <div className="space-y-3">
            {clients.map((client) => (
              <div
                key={client.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-lg font-medium text-primary">
                      {(client.first_name?.[0] || client.username?.[0] || "?").toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    {editingId === client.id ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Input
                          placeholder="Имя"
                          value={editFirstName}
                          onChange={(e) => setEditFirstName(e.target.value)}
                          className="h-8 w-24"
                        />
                        <Input
                          placeholder="Фамилия"
                          value={editLastName}
                          onChange={(e) => setEditLastName(e.target.value)}
                          className="h-8 w-24"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => saveEdit(client.id)}
                          disabled={updateMutation.isPending}
                        >
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={cancelEdit}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground break-words">{getClientName(client)}</p>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 shrink-0"
                          onClick={() => startEdit(client)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                      С {format(new Date(client.created_at), "d MMMM yyyy", { locale: ru })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => openBookingDialog(client)}
                  >
                    <CalendarPlus className="h-4 w-4" />
                    <span className="hidden sm:inline">Назначить</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    asChild
                  >
                    <a
                      href={`https://t.me/${client.username || client.telegram_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span className="hidden sm:inline">Написать</span>
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm(`Удалить клиента ${getClientName(client)}?`)) {
                        deleteClientMutation.mutate(client.id);
                      }
                    }}
                    disabled={deleteClientMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Удалить</span>
                  </Button>
                  <Badge variant="outline" className="gap-1">
                    <Calendar className="h-3 w-3" />
                    {client.bookings?.[0]?.count || 0}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <MessageCircle className="h-3 w-3" />
                    {client.diary_entries?.[0]?.count || 0}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Booking Dialog */}
        <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Назначить консультацию
                {selectedClient && (
                  <span className="block text-sm font-normal text-muted-foreground mt-1">
                    {getClientName(selectedClient)}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Дата</label>
                <CalendarComponent
                  mode="single"
                  selected={bookingDate}
                  onSelect={setBookingDate}
                  locale={ru}
                  disabled={(date) => date < new Date()}
                  className="rounded-md border pointer-events-auto"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Время</label>
                <Select value={bookingTime} onValueChange={setBookingTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите время" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Формат</label>
                <Select value={bookingFormat} onValueChange={(v) => setBookingFormat(v as "online" | "offline")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offline">🏠 Очно</SelectItem>
                    <SelectItem value="online">💻 Онлайн</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={closeBookingDialog}>
                  Отмена
                </Button>
                <Button
                  onClick={handleBookForClient}
                  disabled={!bookingDate || !bookingTime || bookForClientMutation.isPending}
                >
                  {bookForClientMutation.isPending ? "Назначаю..." : "Назначить"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default ClientsList;
