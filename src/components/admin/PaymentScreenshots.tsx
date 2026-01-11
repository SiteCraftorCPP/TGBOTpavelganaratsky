import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Trash2, ExternalLink, User, Save, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";

interface Payment {
  id: string;
  screenshot_url: string;
  created_at: string;
  client_id: string;
  clients: {
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    telegram_id: number;
  } | null;
}

const PaymentScreenshots = () => {
  const queryClient = useQueryClient();
  const [cardNumber, setCardNumber] = useState("");

  // Fetch payment card number
  const { data: cardSetting, isLoading: isLoadingCard } = useQuery({
    queryKey: ["payment_card"],
    queryFn: async () => {
      return await api.getPaymentCard();
    },
  });

  useEffect(() => {
    if (cardSetting?.card_number) {
      setCardNumber(cardSetting.card_number);
    }
  }, [cardSetting]);

  // Save card number mutation
  const saveCardMutation = useMutation({
    mutationFn: async (newCardNumber: string) => {
      await api.savePaymentCard(newCardNumber);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment_card"] });
      toast.success("Номер карты сохранён");
    },
    onError: () => {
      toast.error("Ошибка сохранения");
    },
  });

  // Fetch payments (API returns only recent ones)
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const data = await api.getPayments();
      // Filter payments newer than 7 days on client side
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return data
        .filter((p: any) => new Date(p.created_at) >= weekAgo)
        .map((p: any) => ({
          ...p,
          clients: p.first_name || p.last_name || p.username ? {
            first_name: p.first_name,
            last_name: p.last_name,
            username: p.username,
            telegram_id: p.telegram_id,
          } : null,
        })) as Payment[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      await api.deletePayment(paymentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success("Скриншот удалён");
    },
    onError: () => {
      toast.error("Ошибка удаления");
    },
  });

  const getClientName = (payment: Payment) => {
    if (!payment.clients) return "Неизвестный";
    const { first_name, last_name } = payment.clients;
    return [first_name, last_name].filter(Boolean).join(" ") || "Без имени";
  };

  const handleSaveCard = () => {
    if (cardNumber.trim()) {
      saveCardMutation.mutate(cardNumber.trim());
    }
  };

  return (
    <div className="space-y-6">
      {/* Card Number Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Настройки оплаты
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="cardNumber">Номер карты для оплаты</Label>
              <Input
                id="cardNumber"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="Введите номер карты"
                disabled={isLoadingCard}
              />
              <p className="text-xs text-muted-foreground">
                Этот номер будет отправляться клиентам при нажатии кнопки "Оплата" в боте
              </p>
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleSaveCard}
                disabled={saveCardMutation.isPending || !cardNumber.trim()}
              >
                {saveCardMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span className="ml-2">Сохранить</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Screenshots */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Скриншоты оплаты
            <span className="text-sm font-normal text-muted-foreground ml-2">
              (хранятся 7 дней)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              Загрузка...
            </div>
          ) : !payments || payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mb-2 opacity-50" />
              <p>Нет скриншотов оплаты</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="border rounded-lg overflow-hidden bg-card"
                >
                  <div className="aspect-video relative">
                    <img
                      src={payment.screenshot_url}
                      alt="Скриншот оплаты"
                      className="w-full h-full object-cover"
                    />
                    <a
                      href={payment.screenshot_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute top-2 right-2 p-1.5 bg-background/80 rounded-md hover:bg-background transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{getClientName(payment)}</span>
                      {payment.clients?.username && (
                        <a
                          href={`https://t.me/${payment.clients.username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          @{payment.clients.username}
                        </a>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(payment.created_at), "d MMM yyyy, HH:mm", {
                          locale: ru,
                        })}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(payment.id)}
                        disabled={deleteMutation.isPending}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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

export default PaymentScreenshots;