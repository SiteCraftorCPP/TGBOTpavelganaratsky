import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Settings, Copy, ExternalLink, CheckCircle2 } from "lucide-react";

const BotSetup = () => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  
  const webhookUrl = `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'https://liftme.by'}/webhook`;

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast({ title: "Скопировано!" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Настройка бота
          </CardTitle>
          <CardDescription>
            Инструкция по подключению Telegram бота
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                1
              </span>
              <h3 className="font-medium">Создайте бота в Telegram</h3>
            </div>
            <div className="ml-8 space-y-2 text-muted-foreground">
              <p>Откройте @BotFather в Telegram и создайте нового бота командой /newbot</p>
              <Button variant="outline" size="sm" asChild>
                <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Открыть BotFather
                </a>
              </Button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                2
              </span>
              <h3 className="font-medium">Добавьте токен бота в секреты</h3>
            </div>
            <div className="ml-8 space-y-2 text-muted-foreground">
              <p>Скопируйте токен от BotFather и добавьте его как секрет TELEGRAM_BOT_TOKEN</p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                3
              </span>
              <h3 className="font-medium">Установите webhook</h3>
            </div>
            <div className="ml-8 space-y-3">
              <p className="text-muted-foreground">
                Откройте ссылку ниже в браузере, заменив YOUR_BOT_TOKEN на токен вашего бота:
              </p>
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <div className="flex gap-2">
                  <Input value={webhookUrl} readOnly className="font-mono text-sm" />
                  <Button variant="outline" size="icon" onClick={copyToClipboard}>
                    {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <code className="text-sm break-all">
                  https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url={webhookUrl}
                </code>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success text-xs font-bold text-success-foreground">
                ✓
              </span>
              <h3 className="font-medium">Готово!</h3>
            </div>
            <div className="ml-8 text-muted-foreground">
              <p>Теперь ваш бот готов к работе. Напишите /start в Telegram чтобы начать.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BotSetup;
