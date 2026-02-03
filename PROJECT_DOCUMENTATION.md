# IT Museum - Comprehensive Project Documentation

## Executive Summary

The IT Museum is a sophisticated web application developed for Christ University that serves as a digital platform for preserving and analyzing traditional Indian geometric art forms through computational methods. The project combines modern web technologies with cultural preservation, featuring a multi-stage review workflow for academic article submissions.

---

## 🏗️ Architecture Overview

### System Architecture

```mermaid
graph TB
    A[Client Browser] -->|React App| B[Vite Dev Server]
    B --> C[React Components]
    C --> D[Firebase Services]
    C --> E[Supabase Database]
    D --> F[Firebase Auth]
    D --> G[Firebase Storage]
    D --> H[Firebase Analytics]
    E --> I[Articles Table]
    E --> J[Sections Table]
```

### Data Flow

1. **User Interaction** → React Components
2. **Component Logic** → Service Layer (articleService, contentService)
3. **Service Layer** → Backend (Supabase/Firebase)
4. **Backend** → Response Processing
5. **State Update** → UI Re-render

---

## 📦 Core Components

### Page Components

#### 1. Home (`src/pages/Home.tsx`)

**Purpose**: Landing page with mission statement and hero slideshow

**Key Features**:
- Hero slideshow with institutional images
- Vision, Mission, and Values cards
- Call-to-action buttons
- Dynamic home sections from database

**Dependencies**:
- `HeroSlideshow` component
- `DynamicHomeSections` component
- `useScrollAnimation` hook

#### 2. Collection (`src/pages/Collection.tsx`)

**Purpose**: Display published articles

**Features**:
- Grid layout of article cards
- Fuzzy search functionality (Fuse.js)
- Tag-based filtering
- Dynamic loading of accepted/published articles

**Data Source**: Supabase `articles` table (status: 'accepted' or 'published')

#### 3. Submission (`src/pages/Submission.tsx`)

**Purpose**: Article submission form

**Form Fields**:
- Title (required)
- Author Name (required)
- Institutional Email (required)
- Abstract (150-500 characters, required)
- Google Docs URL (required, validated)

**Validation**:
- Real-time Google Docs URL validation
- Character counter for abstract
- Email format validation
- Required field checking

**Submission Flow**:
```
Form Submit → Validation → articleService.submitArticle() → 
Supabase Insert → Status: 'submitted' → Success Message
```

#### 4. Admin (`src/pages/Admin.tsx`)

**Purpose**: Multi-panel admin dashboard

**User Roles**:
```typescript
interface UserRole {
    email: string;
    password: string;
    role: 'main_admin' | 'first_review' | 'technical_team' | 'literature_review';
}
```

**Admin Panels**:
1. **Main Admin Dashboard**
   - Current Status: `ready_for_publishing`
   - Next Status: `published`
   - Can publish articles to website

2. **First Review Panel**
   - Current Status: `submitted`
   - Next Status: `approved_first`
   - Initial content review

3. **Technical Team Review**
   - Current Status: `approved_first`
   - Next Status: `approved_technical`
   - Technical accuracy verification

4. **Literature Review Panel**
   - Current Status: `approved_technical`
   - Next Status: `approved_literature`
   - Academic and citation review

**Features**:
- Authentication via Firebase Auth
- Role-based panel display
- Test user creation (admin only)
- Logout functionality

#### 5. Article (`src/pages/Article.tsx`)

**Purpose**: Individual article detail view

**Features**:
- Display article metadata
- Show full abstract
- Link to Google Docs submission
- Tag display

#### 6. Team (`src/pages/Team.tsx`)

**Purpose**: Display team members and curators

#### 7. Contact (`src/pages/Contact.tsx`)

**Purpose**: Contact form for inquiries

---

### Shared Components

#### ReviewPanel (`src/components/admin/ReviewPanel.tsx`)

**Purpose**: Reusable component for all review stages

**Props**:
```typescript
interface ReviewPanelProps {
    title: string;                          // Panel display title
    currentStageStatus: Article['status'];  // Current stage filter
    nextStageStatus: Article['status'];     // Next stage on approval
    reviewerName: string;                   // Reviewer identifier
    onActionComplete?: () => void;          // Callback after action
}
```

**Capabilities**:
- Load articles by status
- Edit article title and abstract
- Approve articles (moves to next stage)
- Reject articles (status → 'rejected')
- View Google Docs submissions
- Notification badge (for future implementation)

**UI States**:
1. Loading state
2. Empty state (no articles)
3. Article list view
4. Edit mode (inline editing)

#### KeywordExtractor (`src/components/admin/KeywordExtractor.tsx`)

**Purpose**: Extract keywords from article abstracts

**Features**:
- Automatic keyword extraction
- Integration with keyword-extractor library
- Display extracted tags

#### DynamicHomeSections (`src/components/DynamicHomeSections.tsx`)

**Purpose**: Render dynamic content sections on homepage

**Data Source**: Supabase `sections` table

#### HeroSlideshow (`src/components/HeroSlideshow.tsx`)

**Purpose**: Rotating hero images

**Features**:
- Automatic image rotation
- Smooth transitions
- IT museum-themed images

#### Header (`src/components/Header.tsx`)

**Purpose**: Navigation bar

**Features**:
- Logo display
- Navigation links
- Responsive menu

#### Footer (`src/components/Footer.tsx`)

**Purpose**: Site footer with links and copyright

#### Layout (`src/components/Layout.tsx`)

**Purpose**: Wrapper component for consistent layout

**Structure**:
```jsx
<Layout>
  <Header />
  {children}
  <Footer />
</Layout>
```

---

## 🔧 Services Layer

### Article Service (`src/services/articleService.ts`)

**Interface**:
```typescript
export interface Article {
    id?: string;
    title: string;
    author_name: string;
    institution_email: string;
    abstract: string;
    file_url?: string;
    status: 'submitted' | 'under_review' | 'accepted' | 
            'rejected' | 'approved_first' | 'approved_technical' | 
            'approved_literature' | 'ready_for_publishing' | 'published';
    created_at?: string;
    tags?: string[];
}
```

**Methods**:

1. **submitArticle(data: Article, googleDocUrl: string)**
   - Inserts new article into Supabase
   - Sets initial status to 'submitted'
   - Stores Google Docs URL

2. **getAcceptedArticles()**
   - Fetches published articles
   - Filters by status: 'accepted' or 'published'
   - Orders by creation date (descending)

3. **getPendingArticles(status: Article['status'])**
   - Fetches articles by specific status
   - Used by review panels
   - Orders by creation date (descending)

4. **updateStatus(id: string, status: Article['status'])**
   - Updates article status
   - Used for approval/rejection workflow

5. **updateArticleDetails(id: string, updates: Partial<Article>)**
   - Updates article fields (title, abstract, etc.)
   - Used by reviewers for editing

### Content Service (`src/services/contentService.ts`)

**Interface**:
```typescript
export interface Section {
    id?: string;
    title?: string;
    content?: string;
    order?: number;
    image_url?: string;
    pdf_url?: string;
    created_at?: string;
}
```

**Methods**:

1. **getSections()**
   - Fetches all content sections
   - Orders by 'order' field

2. **addSection(section: Section)**
   - Adds new content section
   - Returns created section

3. **deleteSection(id: string)**
   - Deletes section by ID

---

## 🗄️ Database Schema

### Supabase Configuration

**Connection**: `src/lib/supabase.ts`

```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Tables

#### Articles Table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| title | TEXT | NOT NULL | Article title |
| author_name | TEXT | NOT NULL | Author's full name |
| institution_email | TEXT | NOT NULL | Institutional email |
| abstract | TEXT | NOT NULL | Article summary |
| file_url | TEXT | - | Google Docs URL |
| status | TEXT | NOT NULL | Review status |
| created_at | TIMESTAMP | DEFAULT NOW() | Submission timestamp |
| tags | TEXT[] | - | Article keywords |

**Indexes**:
- Primary key on `id`
- Index on `status` for filtering
- Index on `created_at` for sorting

#### Sections Table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| title | TEXT | - | Section title |
| content | TEXT | - | Section content |
| order | INTEGER | - | Display order |
| image_url | TEXT | - | Section image |
| pdf_url | TEXT | - | PDF attachment |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

**Indexes**:
- Primary key on `id`
- Index on `order` for sorting

---

## 🔐 Authentication System

### Firebase Authentication

**Configuration**: `src/firebase-config.ts`

```typescript
const firebaseConfig = {
    apiKey: "AIzaSyCHGoYNndFtq00JOKpdfBI8645uxwzrxVw",
    authDomain: "it-museum.firebaseapp.com",
    projectId: "it-museum",
    storageBucket: "it-museum.firebasestorage.app",
    messagingSenderId: "49569676822",
    appId: "1:49569676822:web:c85d338f174ae336493f37",
    measurementId: "G-4XX95MCY6D"
};
```

### Admin Credentials

Hardcoded in `src/pages/Admin.tsx`:

```typescript
const ADMIN_EMAILS = {
    MAIN_ADMIN: 'admin@christuniversity.in',
    FIRST_REVIEW: 'firstreview@christuniversity.in',
    TECHNICAL_TEAM: 'technical@christuniversity.in',
    LITERATURE_REVIEW: 'literature@christuniversity.in'
};
```

### Authentication Flow

```mermaid
graph LR
    A[Login Form] --> B[Firebase signInWithEmailAndPassword]
    B --> C{Success?}
    C -->|Yes| D[onAuthStateChanged]
    D --> E[Set User State]
    E --> F[Determine Role]
    F --> G[Display Appropriate Panel]
    C -->|No| H[Show Error]
```

### User State Management

```typescript
const [user, setUser] = useState<User | null>(null);
const [userRole, setUserRole] = useState<UserRole | null>(null);

useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
            // Determine role from email
            const role = determineRole(currentUser.email);
            setUserRole(role);
        }
    });
    return unsubscribe;
}, []);
```

---

## 🎨 Styling System

### CSS Architecture

**Main Stylesheet**: `src/index.css` (23,364 bytes)

### CSS Custom Properties

```css
:root {
    /* Colors */
    --primary: #1a4d7c;
    --primary-light: #2563a8;
    --secondary: #c49a3c;
    --accent: #c49a3c;
    --text: #2c3e50;
    --text-muted: #546e7a;
    --bg-light: #f5f7fa;
    --bg-card: #ffffff;
    
    /* Shadows */
    --shadow-soft: 0 4px 20px rgba(0,0,0,0.08);
    --shadow-hover: 0 8px 30px rgba(0,0,0,0.12);
    
    /* Transitions */
    --transition: all 0.3s ease;
    
    /* Typography */
    --font-family: 'Raleway', sans-serif;
    --font-weight-base: 600;
    --font-weight-heading: 700;
}
```

### Key CSS Classes

1. **`.page`** - Page wrapper with fade-in animation
2. **`.hero`** - Hero section with slideshow
3. **`.card-premium`** - Premium card design with hover effects
4. **`.cta-button`** - Call-to-action button with gradient
5. **`.fade-in`** - Fade-in animation on load
6. **`.form-group`** - Form field wrapper
7. **`.review-panel`** - Admin review panel styling

### Animations

```css
@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.fade-in {
    animation: fadeIn 0.8s ease-out forwards;
}
```

### Responsive Design

```css
@media (max-width: 768px) {
    /* Mobile styles */
    .team-grid {
        grid-template-columns: 1fr;
    }
    
    .hero {
        min-height: 60vh;
    }
}

@media (max-width: 480px) {
    /* Small mobile styles */
    h1 {
        font-size: 2rem;
    }
}
```

---

## 🪝 Custom Hooks

### useScrollAnimation (`src/hooks/useScrollAnimation.ts`)

**Purpose**: Trigger animations on scroll

**Implementation**:
```typescript
export function useScrollAnimation() {
    useEffect(() => {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -100px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, observerOptions);

        // Observe elements with fade-in class
        const elements = document.querySelectorAll('.fade-in');
        elements.forEach(el => observer.observe(el));

        return () => observer.disconnect();
    }, []);
}
```

**Usage**:
```typescript
function MyPage() {
    useScrollAnimation();
    return <div className="fade-in">Content</div>;
}
```

---

## 📊 Review Workflow State Machine

### Status Transitions

```mermaid
stateDiagram-v2
    [*] --> submitted: Article Submitted
    submitted --> approved_first: First Review Approves
    submitted --> rejected: First Review Rejects
    
    approved_first --> approved_technical: Technical Review Approves
    approved_first --> rejected: Technical Review Rejects
    
    approved_technical --> approved_literature: Literature Review Approves
    approved_technical --> rejected: Literature Review Rejects
    
    approved_literature --> ready_for_publishing: Literature Review Approves
    approved_literature --> rejected: Literature Review Rejects
    
    ready_for_publishing --> published: Main Admin Publishes
    ready_for_publishing --> rejected: Main Admin Rejects
    
    published --> [*]: Article Live on Website
    rejected --> [*]: Article Archived
```

### Status Hierarchy

| Status | Code | Panel | Description |
|--------|------|-------|-------------|
| Submitted | `submitted` | First Review | Initial submission |
| First Approved | `approved_first` | Technical Team | Passed first review |
| Technical Approved | `approved_technical` | Literature Review | Passed technical review |
| Literature Approved | `approved_literature` | Main Admin | Passed literature review |
| Ready for Publishing | `ready_for_publishing` | Main Admin | Ready for final approval |
| Published | `published` | - | Live on website |
| Rejected | `rejected` | - | Rejected at any stage |

---

## 🧪 Testing Guidelines

### Manual Testing Checklist

#### Article Submission
- [ ] Form validation works correctly
- [ ] Google Docs URL validation accepts valid URLs
- [ ] Character counter updates in real-time
- [ ] Abstract length validation (150-500 chars)
- [ ] Submission creates record in Supabase
- [ ] Success message displays after submission

#### Review Workflow
- [ ] First Review panel shows 'submitted' articles
- [ ] Approval moves article to 'approved_first'
- [ ] Technical panel shows 'approved_first' articles
- [ ] Literature panel shows 'approved_technical' articles
- [ ] Main admin shows 'approved_literature' articles
- [ ] Rejection sets status to 'rejected'
- [ ] Edit feature saves changes correctly

#### Authentication
- [ ] Login works for all admin accounts
- [ ] Incorrect credentials show error
- [ ] Logout functionality works
- [ ] User state persists on page refresh
- [ ] Role-based panel display is correct

#### UI/UX
- [ ] Animations trigger on scroll
- [ ] Hover effects work on cards and buttons
- [ ] Responsive design works on mobile
- [ ] Hero slideshow rotates images
- [ ] Search functionality works on Collection page

---

## 🚀 Deployment Guide

### Pre-Deployment Checklist

- [ ] Update Firebase configuration
- [ ] Update Supabase credentials in `.env`
- [ ] Update admin email addresses
- [ ] Test all features in production mode
- [ ] Run `npm run build` successfully
- [ ] Check bundle size and optimize if needed

### Build Process

```bash
# Install dependencies
npm install

# Type check
npm run lint

# Build production bundle
npm run build

# Preview production build
npm run preview
```

### Deployment Options

#### Option 1: Firebase Hosting

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase
firebase init hosting

# Build and deploy
npm run build
firebase deploy
```

#### Option 2: Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Production deployment
vercel --prod
```

### Environment Variables

**Production `.env`**:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### Post-Deployment

1. Test all authentication flows
2. Verify database connections
3. Test article submission and review
4. Check analytics integration
5. Monitor error logs

---

## 🔧 Configuration Files

### TypeScript Configuration (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### Vite Configuration (`vite.config.ts`)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

---

## 📈 Performance Optimization

### Current Optimizations

1. **Code Splitting**: React Router lazy loading
2. **Image Optimization**: Compressed hero images
3. **CSS**: Minimal, custom CSS (no framework overhead)
4. **Bundle Size**: Vite tree-shaking for smaller bundles

### Recommended Improvements

1. **Lazy Loading**: Implement React.lazy() for admin components
2. **Image CDN**: Use Firebase Storage CDN for assets
3. **Caching**: Implement service worker for offline support
4. **Database**: Add pagination for large article lists
5. **Search**: Implement server-side search for better performance

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Firebase Authentication Errors

**Problem**: "Firebase: Error (auth/user-not-found)"

**Solution**: Ensure test accounts are created via admin panel

#### 2. Supabase Connection Issues

**Problem**: Articles not loading

**Solution**: 
- Check `.env` file has correct credentials
- Verify Supabase project is active
- Check Row Level Security (RLS) policies

#### 3. Build Errors

**Problem**: TypeScript compilation errors

**Solution**:
```bash
npm run lint
# Fix type errors and rebuild
```

#### 4. Google Docs URL Validation

**Problem**: Valid URLs rejected

**Solution**: Ensure URL matches pattern:
- `https://docs.google.com/document/d/...`
- Must include `/edit` or sharing parameters

### Debug Mode

Enable console logging in services:
```typescript
// In articleService.ts
console.log('Submitting article:', data);
console.log('Response:', result);
```

---

## 📚 Additional Resources

### Dependencies Documentation

- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [Firebase](https://firebase.google.com/docs)
- [Supabase](https://supabase.com/docs)
- [Framer Motion](https://www.framer.com/motion/)
- [Fuse.js](https://fusejs.io/)

### Git Repository

- **URL**: https://github.com/itmuseum-christuniversity/IT-Museum
- **Branch**: main
- **Issues**: Use GitHub Issues for bug reports

---

## 🔄 Future Enhancements

### Planned Features

1. **Email Notifications**: Notify submitters and reviewers of status changes
2. **Article History**: Track all changes and reviews
3. **Advanced Search**: Full-text search with filters
4. **Analytics Dashboard**: Track submission metrics
5. **PDF Generation**: Export articles as PDFs
6. **Multi-language Support**: Hindi and regional languages
7. **Mobile App**: React Native companion app

### Technical Debt

1. Replace hardcoded credentials with environment variables
2. Implement comprehensive error handling
3. Add unit tests (Jest + React Testing Library)
4. Add E2E tests (Playwright)
5. Implement logging and monitoring
6. Add rate limiting for submissions

---

## 📞 Support

For technical support or questions:

- **Email**: Contact through the website Contact page
- **GitHub Issues**: Report bugs at repository issues page
- **Documentation**: Refer to this document and README.md

---

**Last Updated**: January 27, 2026  
**Version**: 1.0.0  
**Maintained by**: Christ University IT Museum Team
