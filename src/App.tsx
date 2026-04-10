import { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import { Share2, History, Trash2, Sparkles, Trophy, LogIn, LogOut, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { analyzeDumbassLevel, DumbassResult } from "./services/gemini";
import { db, auth, loginWithGoogle, logout, handleFirestoreError, OperationType } from "./firebase";
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";

interface HistoryItem extends DumbassResult {
  id: string;
  date: string;
  description: string;
}

interface LeaderboardEntry {
  id: string;
  userId: string;
  username: string;
  percentage: number;
  badge: string;
  description: string;
  createdAt: any;
}

export default function App() {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DumbassResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  // Leaderboard & Auth state
  const [user, setUser] = useState<User | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [submittingScore, setSubmittingScore] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("dumbassHistory");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser?.displayName) {
        setUsername(currentUser.displayName);
      }
    });

    const q = query(collection(db, "leaderboard"), orderBy("percentage", "desc"), limit(50));
    const unsubscribeDb = onSnapshot(q, (snapshot) => {
      const entries: LeaderboardEntry[] = [];
      snapshot.forEach((doc) => {
        entries.push({ id: doc.id, ...doc.data() } as LeaderboardEntry);
      });
      setLeaderboard(entries);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "leaderboard");
    });

    return () => {
      unsubscribeAuth();
      unsubscribeDb();
    };
  }, []);

  const saveToHistory = (res: DumbassResult, desc: string) => {
    const newItem: HistoryItem = {
      ...res,
      id: Date.now().toString(),
      date: new Date().toLocaleDateString("lt-LT"),
      description: desc,
    };
    const newHistory = [newItem, ...history].slice(0, 10); // Keep last 10
    setHistory(newHistory);
    localStorage.setItem("dumbassHistory", JSON.stringify(newHistory));
  };

  const handleCheck = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await analyzeDumbassLevel(description);
      setResult(res);
      saveToHistory(res, description);

      if (res.percentage > 90) {
        triggerConfetti();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const submitToLeaderboard = async () => {
    if (!user || !result || !username.trim()) return;
    setSubmittingScore(true);
    try {
      await addDoc(collection(db, "leaderboard"), {
        userId: user.uid,
        username: username.trim().substring(0, 50),
        percentage: result.percentage,
        badge: result.badge,
        description: description.substring(0, 500),
        createdAt: serverTimestamp(),
      });
      setIsSubmitDialogOpen(false);
      setShowLeaderboard(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "leaderboard");
    } finally {
      setSubmittingScore(false);
    }
  };

  const triggerConfetti = () => {
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#ff00ff', '#00ffff', '#ffff00']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#ff00ff', '#00ffff', '#ffff00']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  const handleShare = async () => {
    if (!result) return;
    const text = `Šiandien mano kvailumo lygis: ${result.percentage}%! 🤪\nMano titulas: ${result.badge}\n\nIšbandyk ir tu: "Ar Aš Šiandien Kvailys?"`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Ar Aš Šiandien Kvailys?',
          text: text,
          url: window.location.href,
        });
      } catch (e) {
        console.error("Error sharing", e);
      }
    } else {
      navigator.clipboard.writeText(text);
      alert("Nukopijuota į iškarpinę!");
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("dumbassHistory");
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-secondary/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Auth Bar */}
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        {user ? (
          <Button variant="outline" size="sm" onClick={logout} className="bg-background/50 backdrop-blur-md">
            <LogOut className="w-4 h-4 mr-2" /> Atsijungti
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={loginWithGoogle} className="bg-background/50 backdrop-blur-md">
            <LogIn className="w-4 h-4 mr-2" /> Prisijungti
          </Button>
        )}
      </div>

      <div className="w-full max-w-2xl z-10 space-y-8 mt-12">
        <div className="text-center space-y-4">
          <h1 className="text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-secondary drop-shadow-lg animate-in fade-in slide-in-from-top-8 duration-700">
            Ar Aš Šiandien Kvailys? 🤡
          </h1>
          <p className="text-xl text-muted-foreground font-medium">
            Įvesk savo dienos aprašymą ir sužinok karčią tiesą.
          </p>
        </div>

        <Card className="border-4 border-primary/50 shadow-[0_0_30px_rgba(var(--primary),0.3)] bg-card/80 backdrop-blur-sm">
          <CardContent className="pt-6 space-y-4">
            <Textarea
              placeholder="Pvz.: Šiandien atsikėliau 14 val., suvalgiau 3 picas ir žiūrėjau TikTok 5 valandas..."
              className="min-h-[120px] text-lg resize-none border-2 focus-visible:ring-primary"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Button 
              size="lg" 
              className="w-full text-xl h-16 font-heading tracking-widest bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
              onClick={handleCheck}
              disabled={loading || !description.trim()}
            >
              {loading ? (
                <span className="flex items-center gap-2 animate-pulse">
                  <Sparkles className="w-6 h-6 animate-spin" /> Analizuojama...
                </span>
              ) : (
                "PATIKRINTI KVAILUMĄ! 🚀"
              )}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card className="border-4 border-secondary/50 shadow-[0_0_30px_rgba(var(--secondary),0.3)] bg-card/90 backdrop-blur-md animate-in zoom-in-95 duration-500">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-3xl font-heading text-secondary">Rezultatas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-center">
              <div className="space-y-2">
                <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 drop-shadow-md">
                  {result.percentage}%
                </div>
                <Progress value={result.percentage} className="h-4 w-full bg-muted" />
                <Badge variant="outline" className="text-2xl py-2 px-4 border-2 border-accent text-accent mt-4">
                  {result.badge}
                </Badge>
              </div>

              <div className="bg-destructive/10 border-2 border-destructive/50 rounded-xl p-4 text-left">
                <h3 className="font-heading text-destructive text-xl mb-2">🔥 Brutalus Roast'as:</h3>
                <p className="text-lg italic text-foreground/90">"{result.roast}"</p>
              </div>

              <div className="bg-primary/10 border-2 border-primary/50 rounded-xl p-4 text-left">
                <h3 className="font-heading text-primary text-xl mb-2">💡 Absurdiški Patarimai:</h3>
                <ul className="space-y-2">
                  {result.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-foreground/80">
                      <span className="text-primary font-bold">👉</span> {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row justify-center gap-4">
              <Button onClick={handleShare} variant="secondary" className="font-bold text-lg w-full sm:w-auto">
                <Share2 className="w-5 h-5 mr-2" />
                Dalintis
              </Button>
              <Button 
                onClick={() => {
                  if (!user) {
                    loginWithGoogle().then(() => setIsSubmitDialogOpen(true));
                  } else {
                    setIsSubmitDialogOpen(true);
                  }
                }} 
                className="font-bold text-lg w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/80"
              >
                <Trophy className="w-5 h-5 mr-2" />
                Į Gėdos Lentą!
              </Button>
            </CardFooter>
          </Card>
        )}

        <div className="flex justify-center gap-4 flex-wrap">
          <Button 
            variant="ghost" 
            onClick={() => {
              setShowLeaderboard(true);
              setShowHistory(false);
            }}
            className={`text-muted-foreground hover:text-foreground ${showLeaderboard ? 'bg-muted' : ''}`}
          >
            <Trophy className="w-4 h-4 mr-2 text-accent" />
            Gėdos Lenta
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => {
              setShowHistory(true);
              setShowLeaderboard(false);
            }}
            className={`text-muted-foreground hover:text-foreground ${showHistory ? 'bg-muted' : ''}`}
          >
            <History className="w-4 h-4 mr-2" />
            Mano Istorija
          </Button>
        </div>

        {showLeaderboard && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-heading text-accent flex items-center gap-2">
                <Trophy className="w-8 h-8" /> Pasaulinė Gėdos Lenta
              </h2>
            </div>
            {leaderboard.length === 0 ? (
              <p className="text-center text-muted-foreground italic">Kol kas niekas neišdrįso pasidalinti savo kvailumu...</p>
            ) : (
              <div className="grid gap-4">
                {leaderboard.map((item, index) => (
                  <Card key={item.id} className={`bg-card/50 border-muted relative overflow-hidden ${index === 0 ? 'border-accent/50 shadow-[0_0_15px_rgba(var(--accent),0.2)]' : ''}`}>
                    {index === 0 && <div className="absolute top-0 right-0 bg-accent text-accent-foreground text-xs font-bold px-2 py-1 rounded-bl-lg">#1 KVAILYS</div>}
                    <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-4">
                      <div className="text-4xl font-black text-muted-foreground w-24 text-center flex items-center justify-center gap-1">
                        <span className="text-xl text-muted-foreground/50">#{index + 1}</span>
                        <span className={index === 0 ? 'text-accent' : ''}>{item.percentage}%</span>
                      </div>
                      <div className="flex-1 space-y-1 text-center sm:text-left">
                        <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                          <span className="font-bold text-lg">{item.username}</span>
                          <Badge variant="secondary">{item.badge}</Badge>
                        </div>
                        <p className="text-sm text-foreground/70 line-clamp-2 italic">"{item.description}"</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {showHistory && history.length > 0 && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-heading text-secondary">Mano Istorija</h2>
              <Button variant="destructive" size="sm" onClick={clearHistory}>
                <Trash2 className="w-4 h-4 mr-2" /> Valyti
              </Button>
            </div>
            <div className="grid gap-4">
              {history.map((item) => (
                <Card key={item.id} className="bg-card/50 border-muted">
                  <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-4">
                    <div className="text-4xl font-black text-muted-foreground w-24 text-center">
                      {item.percentage}%
                    </div>
                    <div className="flex-1 space-y-1 text-center sm:text-left">
                      <div className="flex items-center justify-center sm:justify-start gap-2">
                        <Badge variant="secondary">{item.badge}</Badge>
                        <span className="text-xs text-muted-foreground">{item.date}</span>
                      </div>
                      <p className="text-sm text-foreground/70 line-clamp-2 italic">"{item.description}"</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl text-accent">Paskelbti Gėdos Lentoje!</DialogTitle>
            <DialogDescription>
              Tavo kvailumo lygis yra {result?.percentage}%. Įvesk savo vardą, kad visas pasaulis žinotų.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2 py-4">
            <div className="grid flex-1 gap-2">
              <Input
                id="username"
                placeholder="Tavo vardas ar slapyvardis"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={50}
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button 
              type="button" 
              onClick={submitToLeaderboard} 
              disabled={submittingScore || !username.trim()}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/80"
            >
              {submittingScore ? "Skelbiama..." : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Paskelbti!
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

