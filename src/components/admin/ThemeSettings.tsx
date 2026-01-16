import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sun, Moon, Save, X, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

const ThemeSettings = () => {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [aboutMeText, setAboutMeText] = useState("");
  const [aboutMePhoto, setAboutMePhoto] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const queryClient = useQueryClient();

  // Fetch about me settings
  const { data: aboutMeSettings, isLoading: isLoadingAboutMe } = useQuery({
    queryKey: ["about_me"],
    queryFn: async () => {
      return await api.getAboutMe();
    },
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    // Default to dark theme if no saved preference
    const initialTheme = savedTheme || "dark";
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  useEffect(() => {
    if (aboutMeSettings) {
      setAboutMeText(aboutMeSettings.text || "");
      // Add cache-busting parameter to photo URL if it exists
      if (aboutMeSettings.photo_url) {
        try {
          const url = aboutMeSettings.photo_url.startsWith('http') 
            ? new URL(aboutMeSettings.photo_url)
            : new URL(aboutMeSettings.photo_url, window.location.origin);
          url.searchParams.set('t', Date.now().toString());
          setAboutMePhoto(url.toString());
        } catch (e) {
          // Fallback: just use the URL as-is with query param
          const separator = aboutMeSettings.photo_url.includes('?') ? '&' : '?';
          setAboutMePhoto(`${aboutMeSettings.photo_url}${separator}t=${Date.now()}`);
        }
      } else {
        setAboutMePhoto(null);
      }
    }
  }, [aboutMeSettings]);

  const setThemeAndSave = (newTheme: "light" | "dark") => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const saveAboutMeMutation = useMutation({
    mutationFn: async (data: { text: string; photo?: File; remove_photo?: boolean }) => {
      return await api.saveAboutMe(data);
    },
    onSuccess: (response) => {
      // Update photo URL immediately from response with cache-busting
      if (response.photo_url) {
        try {
          const url = response.photo_url.startsWith('http') 
            ? new URL(response.photo_url)
            : new URL(response.photo_url, window.location.origin);
          url.searchParams.set('t', Date.now().toString());
          setAboutMePhoto(url.toString());
        } catch (e) {
          // Fallback: just use the URL as-is with query param
          const separator = response.photo_url.includes('?') ? '&' : '?';
          setAboutMePhoto(`${response.photo_url}${separator}t=${Date.now()}`);
        }
      } else {
        setAboutMePhoto(null);
      }
      setPhotoFile(null);
      // Invalidate query after a short delay to refresh data
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["about_me"] });
      }, 100);
      toast.success("Информация сохранена");
    },
    onError: (error: Error) => {
      console.error('Error saving about me:', error);
      toast.error(`Ошибка сохранения: ${error.message}`);
    },
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith("image/")) {
        setPhotoFile(file);
        const reader = new FileReader();
        reader.onload = (event) => {
          setAboutMePhoto(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        toast.error("Выберите изображение");
      }
    }
  };

  const handleRemovePhoto = () => {
    setAboutMePhoto(null);
    setPhotoFile(null);
  };

  const handleSaveAboutMe = () => {
    if (!aboutMeText.trim() && !aboutMePhoto && !photoFile) {
      toast.error("Заполните текст или загрузите фото");
      return;
    }
    // If photo was removed (was set but now null and no new file), send remove_photo flag
    const shouldRemovePhoto = aboutMeSettings?.photo_url && !aboutMePhoto && !photoFile;
    saveAboutMeMutation.mutate({ 
      text: aboutMeText, 
      photo: photoFile || undefined,
      remove_photo: shouldRemovePhoto 
    });
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

      <Card>
        <CardHeader>
          <CardTitle>Информация "Обо мне"</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Photo */}
          <div className="space-y-2">
            <Label>Фото</Label>
            {aboutMePhoto ? (
              <div className="relative inline-block">
                <img
                  src={aboutMePhoto}
                  alt="Обо мне"
                  className="h-32 w-32 object-cover rounded-lg border border-border"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={handleRemovePhoto}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Label htmlFor="photo-upload" className="cursor-pointer">
                  <Button variant="outline" type="button" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Загрузить фото
                    </span>
                  </Button>
                </Label>
                <Input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Text */}
          <div className="space-y-2">
            <Label htmlFor="about-me-text">Текст "Обо мне"</Label>
            <Textarea
              id="about-me-text"
              value={aboutMeText}
              onChange={(e) => setAboutMeText(e.target.value)}
              placeholder="Информация обо мне..."
              rows={6}
              disabled={isLoadingAboutMe || saveAboutMeMutation.isPending}
            />
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSaveAboutMe}
            disabled={isLoadingAboutMe || saveAboutMeMutation.isPending}
            className="w-full"
          >
            <Save className="h-4 w-4 mr-2" />
            Сохранить
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ThemeSettings;
