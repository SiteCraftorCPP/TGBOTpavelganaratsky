import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Users, AlertTriangle, Settings, CreditCard } from "lucide-react";
import SlotsManager from "@/components/admin/SlotsManager";
import ClientsList from "@/components/admin/ClientsList";
import SosRequests from "@/components/admin/SosRequests";
import ThemeSettings from "@/components/admin/ThemeSettings";
import PaymentScreenshots from "@/components/admin/PaymentScreenshots";
import liftmeLogo from "@/assets/liftme-logo.jpg";

const Index = () => {
  const [activeTab, setActiveTab] = useState("slots");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="w-full px-4 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl overflow-hidden flex items-center justify-center">
              <img src={liftmeLogo} alt="LIFTme-Bot" className="h-full w-full object-cover" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">LIFTme-Bot</h1>
              <p className="text-sm text-muted-foreground">Твой Ассистент</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-4 py-6 max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="slots" className="gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Расписание</span>
            </TabsTrigger>
            <TabsTrigger value="clients" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Клиенты</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Оплаты</span>
            </TabsTrigger>
            <TabsTrigger value="sos" className="gap-2 relative">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">SOS</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Настройки</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="slots" className="animate-fade-in">
            <SlotsManager />
          </TabsContent>

          <TabsContent value="clients" className="animate-fade-in">
            <ClientsList />
          </TabsContent>

          <TabsContent value="payments" className="animate-fade-in">
            <PaymentScreenshots />
          </TabsContent>

          <TabsContent value="sos" className="animate-fade-in">
            <SosRequests />
          </TabsContent>

          <TabsContent value="settings" className="animate-fade-in">
            <ThemeSettings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
