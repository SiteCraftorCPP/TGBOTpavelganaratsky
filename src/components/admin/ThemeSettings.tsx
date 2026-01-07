import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

const ThemeSettings = () => {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    // Default to dark theme if no saved preference
    const initialTheme = savedTheme || "dark";
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  const setThemeAndSave = (newTheme: "light" | "dark") => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Тема оформления</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              onClick={() => setThemeAndSave("light")}
              className="flex-1 h-20 flex-col gap-2"
            >
              <Sun className="h-6 w-6" />
              <span>Светлая</span>
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              onClick={() => setThemeAndSave("dark")}
              className="flex-1 h-20 flex-col gap-2"
            >
              <Moon className="h-6 w-6" />
              <span>Тёмная</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ThemeSettings;
