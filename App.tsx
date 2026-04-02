
import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import LessonView from './components/LessonView';
import Footer from './components/Footer';
import { User, Lesson } from './types';
import { MOCK_LESSONS } from './constants';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('acne_zero_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [watchedLessons, setWatchedLessons] = useState<string[]>([]);

  // Load user-specific progress when user changes
  useEffect(() => {
    if (user?.email) {
      const userKey = `acne_zero_progress_${user.email}`;
      const savedProgress = localStorage.getItem(userKey);
      setWatchedLessons(savedProgress ? JSON.parse(savedProgress) : []);
      
      const savedLesson = localStorage.getItem(`acne_zero_lesson_${user.email}`);
      setCurrentLesson(savedLesson ? JSON.parse(savedLesson) : null);
    } else {
      setWatchedLessons([]);
      setCurrentLesson(null);
    }
  }, [user?.email]);

  // Persist user state
  useEffect(() => {
    if (user) {
      localStorage.setItem('acne_zero_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('acne_zero_user');
    }
  }, [user]);

  // Persist progress per user
  useEffect(() => {
    if (user?.email) {
      localStorage.setItem(`acne_zero_progress_${user.email}`, JSON.stringify(watchedLessons));
    }
  }, [watchedLessons, user?.email]);

  useEffect(() => {
    if (user?.email && currentLesson) {
      localStorage.setItem(`acne_zero_lesson_${user.email}`, JSON.stringify(currentLesson));
    } else if (user?.email) {
      localStorage.removeItem(`acne_zero_lesson_${user.email}`);
    }
  }, [currentLesson, user?.email]);

  // Fetch purchases from backend
  useEffect(() => {
    if (user?.email) {
      const fetchPurchases = async () => {
        try {
          const response = await fetch(`/api/user/purchases?email=${encodeURIComponent(user.email)}`);
          if (response.ok) {
            const data = await response.json();
            
            const currentPurchased = user.purchasedCategories || [];
            const currentRevoked = user.revokedCategories || [];
            
            const hasPurchasedChange = JSON.stringify(currentPurchased.sort()) !== JSON.stringify((data.purchasedCategories || []).sort());
            const hasRevokedChange = JSON.stringify(currentRevoked.sort()) !== JSON.stringify((data.revokedCategories || []).sort());
            
            if (hasPurchasedChange || hasRevokedChange) {
              setUser({
                ...user,
                purchasedCategories: data.purchasedCategories || [],
                revokedCategories: data.revokedCategories || []
              });
            }
          }
        } catch (error) {
          console.error("Error fetching purchases:", error);
        }
      };

      fetchPurchases();
      // Poll every 10 seconds to check for new purchases/revocations
      const interval = setInterval(fetchPurchases, 10000);
      return () => clearInterval(interval);
    }
  }, [user?.email]);

  const handleLogin = (email: string) => {
    setUser({ email, isAuthenticated: true });
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentLesson(null);
  };

  const handleMarkWatched = (id: string) => {
    if (!watchedLessons.includes(id)) {
      setWatchedLessons([...watchedLessons, id]);
    }
  };

  const handleNextLesson = () => {
    if (!currentLesson) return;
    const currentIndex = MOCK_LESSONS.findIndex(l => l.id === currentLesson.id);
    if (currentIndex < MOCK_LESSONS.length - 1) {
      setCurrentLesson(MOCK_LESSONS[currentIndex + 1]);
    } else {
      setCurrentLesson(null); // Course finished back to dashboard
    }
  };

  const handlePurchase = (categoryId: string) => {
    if (!user) return;
    const purchased = user.purchasedCategories || [];
    if (!purchased.includes(categoryId)) {
      setUser({
        ...user,
        purchasedCategories: [...purchased, categoryId]
      });
    }
  };

  if (!user?.isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-200 flex flex-col">
      <Navbar 
        email={user.email} 
        onLogout={handleLogout} 
        onGoHome={() => setCurrentLesson(null)} 
      />
      
      <main className="flex-grow">
        {currentLesson ? (
          <LessonView 
            lesson={currentLesson}
            watchedLessons={watchedLessons}
            onMarkWatched={handleMarkWatched}
            onNext={handleNextLesson}
            onBack={() => setCurrentLesson(null)}
          />
        ) : (
          <Dashboard 
            user={user}
            watchedLessons={watchedLessons}
            onSelectLesson={setCurrentLesson}
            onPurchase={handlePurchase}
          />
        )}
      </main>

      <Footer />

      {/* Floating Progress Tracker for Mobile */}
      {!currentLesson && watchedLessons.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#161b22] rounded-full shadow-2xl border border-slate-800 px-6 py-3 flex items-center gap-4 z-40 sm:hidden">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Progresso</div>
          <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-pink-500 transition-all duration-1000 shadow-[0_0_8px_rgba(236,72,153,0.5)]" 
              style={{ width: `${(watchedLessons.length / MOCK_LESSONS.length) * 100}%` }}
            ></div>
          </div>
          <div className="text-xs font-black text-white">
            {watchedLessons.length}/{MOCK_LESSONS.length}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
