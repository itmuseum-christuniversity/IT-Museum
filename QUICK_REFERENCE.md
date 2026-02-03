# IT Museum - Quick Reference Guide

## 🚀 Quick Start Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run lint
```

## 📁 File Locations Quick Reference

| Item | Path |
|------|------|
| Main App | `src/App.tsx` |
| Firebase Config | `src/firebase-config.ts` |
| Supabase Client | `src/lib/supabase.ts` |
| Article Service | `src/services/articleService.ts` |
| Admin Page | `src/pages/Admin.tsx` |
| Submission Form | `src/pages/Submission.tsx` |
| Global Styles | `src/index.css` |
| Environment Vars | `.env` |

## 🔑 Admin Credentials

```typescript
// Default admin accounts
Main Admin:
  Email: admin@christuniversity.in
  Password: admin123

First Review:
  Email: firstreview@christuniversity.in
  Password: first123

Technical Team:
  Email: technical@christuniversity.in
  Password: tech123

Literature Review:
  Email: literature@christuniversity.in
  Password: lit123
```

## 📊 Article Status Flow

```
submitted → approved_first → approved_technical → 
approved_literature → ready_for_publishing → published
```

## 🛠️ Common Code Snippets

### Submit an Article

```typescript
import { articleService } from './services/articleService';

const handleSubmit = async () => {
    const article = {
        title: "Article Title",
        author_name: "John Doe",
        institution_email: "john@christuniversity.in",
        abstract: "Article abstract...",
    };
    
    const googleDocUrl = "https://docs.google.com/document/d/...";
    
    try {
        const result = await articleService.submitArticle(article, googleDocUrl);
        console.log("Submitted:", result);
    } catch (error) {
        console.error("Error:", error);
    }
};
```

### Fetch Published Articles

```typescript
import { articleService } from './services/articleService';

const loadArticles = async () => {
    try {
        const articles = await articleService.getAcceptedArticles();
        console.log("Articles:", articles);
    } catch (error) {
        console.error("Error:", error);
    }
};
```

### Update Article Status

```typescript
import { articleService } from './services/articleService';

const approveArticle = async (articleId: string) => {
    try {
        await articleService.updateStatus(articleId, 'approved_first');
        console.log("Article approved");
    } catch (error) {
        console.error("Error:", error);
    }
};
```

### Edit Article Details

```typescript
import { articleService } from './services/articleService';

const editArticle = async (articleId: string) => {
    const updates = {
        title: "Updated Title",
        abstract: "Updated abstract..."
    };
    
    try {
        await articleService.updateArticleDetails(articleId, updates);
        console.log("Article updated");
    } catch (error) {
        console.error("Error:", error);
    }
};
```

## 🎨 CSS Custom Properties

```css
/* Use these variables in your styles */
var(--primary)           /* #1a4d7c - Deep Blue */
var(--secondary)         /* #c49a3c - Gold */
var(--text)              /* #2c3e50 - Dark Text */
var(--text-muted)        /* #546e7a - Muted Text */
var(--bg-light)          /* #f5f7fa - Light Background */
var(--shadow-soft)       /* Soft shadow */
var(--transition)        /* Standard transition */
```

## 🔧 Environment Variables

```env
# .env file
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

## 📦 Component Import Examples

```typescript
// Page components
import Home from './pages/Home';
import Collection from './pages/Collection';
import Submission from './pages/Submission';
import Admin from './pages/Admin';

// Shared components
import Header from './components/Header';
import Footer from './components/Footer';
import ReviewPanel from './components/admin/ReviewPanel';

// Services
import { articleService } from './services/articleService';
import { contentService } from './services/contentService';

// Hooks
import { useScrollAnimation } from './hooks/useScrollAnimation';
```

## 🗄️ Database Queries (Supabase)

### Fetch Articles by Status

```typescript
import { supabase } from './lib/supabase';

const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('status', 'submitted')
    .order('created_at', { ascending: false });
```

### Insert New Article

```typescript
import { supabase } from './lib/supabase';

const { data, error } = await supabase
    .from('articles')
    .insert([{
        title: "Article Title",
        author_name: "John Doe",
        institution_email: "john@christuniversity.in",
        abstract: "Abstract...",
        file_url: "https://docs.google.com/...",
        status: 'submitted'
    }])
    .select()
    .single();
```

### Update Article

```typescript
import { supabase } from './lib/supabase';

const { data, error } = await supabase
    .from('articles')
    .update({ status: 'approved_first' })
    .eq('id', articleId)
    .select()
    .single();
```

## 🔐 Firebase Authentication

### Sign In

```typescript
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase-config';

const handleLogin = async (email: string, password: string) => {
    try {
        const userCredential = await signInWithEmailAndPassword(
            auth, 
            email, 
            password
        );
        console.log("Logged in:", userCredential.user);
    } catch (error) {
        console.error("Login error:", error);
    }
};
```

### Sign Out

```typescript
import { signOut } from 'firebase/auth';
import { auth } from './firebase-config';

const handleLogout = async () => {
    try {
        await signOut(auth);
        console.log("Logged out");
    } catch (error) {
        console.error("Logout error:", error);
    }
};
```

### Monitor Auth State

```typescript
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase-config';

useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("User logged in:", user.email);
        } else {
            console.log("User logged out");
        }
    });
    
    return unsubscribe;
}, []);
```

## 🎯 ReviewPanel Component Usage

```typescript
import ReviewPanel from './components/admin/ReviewPanel';

<ReviewPanel
    title="First Review Panel"
    currentStageStatus="submitted"
    nextStageStatus="approved_first"
    reviewerName="First Reviewer"
    onActionComplete={() => console.log("Action complete")}
/>
```

## 📝 Form Validation Patterns

### Google Docs URL Validation

```typescript
const validateGoogleDocUrl = (url: string) => {
    const pattern = /^https:\/\/docs\.google\.com\/document\/d\/[a-zA-Z0-9_-]+/;
    return pattern.test(url);
};
```

### Email Validation

```typescript
const validateEmail = (email: string) => {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email);
};
```

### Abstract Length Validation

```typescript
const validateAbstract = (text: string) => {
    const length = text.trim().length;
    return length >= 150 && length <= 500;
};
```

## 🔍 Search Implementation (Fuse.js)

```typescript
import Fuse from 'fuse.js';

const searchArticles = (articles: Article[], query: string) => {
    const fuse = new Fuse(articles, {
        keys: ['title', 'author_name', 'abstract', 'tags'],
        threshold: 0.3,
        distance: 100
    });
    
    const results = fuse.search(query);
    return results.map(result => result.item);
};
```

## 🎨 Common CSS Classes

```css
/* Card with premium styling */
.card-premium {
    background: var(--bg-card);
    padding: 2rem;
    border-radius: 12px;
    box-shadow: var(--shadow-soft);
    transition: var(--transition);
}

/* Call-to-action button */
.cta-button {
    background: linear-gradient(135deg, var(--primary), var(--primary-light));
    color: white;
    padding: 1rem 2rem;
    border-radius: 8px;
    font-weight: 600;
    transition: var(--transition);
}

/* Fade-in animation */
.fade-in {
    opacity: 0;
    animation: fadeIn 0.8s ease-out forwards;
}

/* Form input */
.form-group input,
.form-group textarea {
    width: 100%;
    padding: 1rem;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    font-family: inherit;
}
```

## 🐛 Debugging Tips

### Enable Detailed Logging

```typescript
// In articleService.ts
async submitArticle(data: Article, googleDocUrl: string) {
    console.log('📝 Submitting article:', data);
    console.log('🔗 Google Doc URL:', googleDocUrl);
    
    const result = await supabase.from('articles').insert([...]);
    
    console.log('✅ Result:', result);
    console.log('❌ Error:', result.error);
    
    return result;
}
```

### Check Supabase Connection

```typescript
const testConnection = async () => {
    const { data, error } = await supabase
        .from('articles')
        .select('count');
    
    if (error) {
        console.error('❌ Supabase connection failed:', error);
    } else {
        console.log('✅ Supabase connected, article count:', data);
    }
};
```

### Check Firebase Authentication

```typescript
import { auth } from './firebase-config';

console.log('Current user:', auth.currentUser);
console.log('Auth ready:', !!auth.currentUser);
```

## 📊 Useful TypeScript Types

```typescript
// Article interface
interface Article {
    id?: string;
    title: string;
    author_name: string;
    institution_email: string;
    abstract: string;
    file_url?: string;
    status: ArticleStatus;
    created_at?: string;
    tags?: string[];
}

// Article status union type
type ArticleStatus = 
    | 'submitted' 
    | 'approved_first' 
    | 'approved_technical' 
    | 'approved_literature' 
    | 'ready_for_publishing' 
    | 'published' 
    | 'rejected';

// User role type
type UserRole = 
    | 'main_admin' 
    | 'first_review' 
    | 'technical_team' 
    | 'literature_review';

// Section interface
interface Section {
    id?: string;
    title?: string;
    content?: string;
    order?: number;
    image_url?: string;
    pdf_url?: string;
    created_at?: string;
}
```

## 🔄 Git Workflow

```bash
# Check status
git status

# Add files
git add .

# Commit changes
git commit -m "feat: add new feature"

# Push to remote
git push origin main

# Pull latest changes
git pull origin main

# Create new branch
git checkout -b feature/new-feature
```

## 📞 Quick Links

- **GitHub Repo**: https://github.com/itmuseum-christuniversity/IT-Museum
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Firebase Console**: https://console.firebase.google.com
- **Vite Docs**: https://vitejs.dev
- **React Docs**: https://react.dev

---

**Pro Tip**: Bookmark this file for quick reference during development!
