# IT Museum - Christ University

> A digital platform preserving and analyzing traditional Indian geometric art forms through the lens of computation and ethnomathematics.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Multi-Stage Review Workflow](#multi-stage-review-workflow)
- [Deployment](#deployment)
- [Contributing](#contributing)

## 🎯 Overview

The IT Museum is a sophisticated web application that bridges traditional Indian art forms with modern computer science. Built for Christ University, this platform serves as a global beacon for digital preservation of intangible cultural heritage, archiving and analyzing traditional geometric art using Array Grammars.

### Core Mission

- **Vision**: Digital preservation of intangible cultural heritage
- **Mission**: Archive and model traditional geometric art using computational methods
- **Values**: Integrity in preservation and inclusivity in access

## ✨ Features

### Public Features

- **Dynamic Home Page**: Hero slideshow with institutional branding
- **Article Collection**: Browse published research articles on traditional art forms
- **Team Page**: Meet the curators and researchers
- **Contact Form**: Get in touch with the museum
- **Article Submission**: Google Docs-based article submission system
- **Responsive Design**: Premium UI with animations and glassmorphism effects

### Admin Features

- **Multi-Stage Review Workflow**: Four-tier review system
  - First Review Panel
  - Technical Team Review
  - Literature Review Panel
  - Main Admin Dashboard
- **Article Management**: Edit, approve, or reject submissions
- **Status Tracking**: Monitor articles through review pipeline
- **Keyword Extraction**: Automated keyword extraction from articles
- **Real-time Notifications**: Activity tracking for reviewers

## 🛠 Technology Stack

### Frontend

- **Framework**: React 19.2.3 with TypeScript
- **Build Tool**: Vite 7.3.0
- **Routing**: React Router DOM 7.11.0
- **Styling**: Vanilla CSS with custom variables
- **Animations**: Framer Motion 12.23.26
- **Icons**: Lucide React 0.562.0
- **Typography**: Raleway (SemiBold 600 base)

### Backend & Services

- **Database**: Supabase (PostgreSQL)
- **Authentication**: Firebase Auth
- **Storage**: Firebase Storage
- **Analytics**: Firebase Analytics

### Additional Libraries

- **Search**: Fuse.js 7.1.0 (fuzzy search)
- **Keyword Extraction**: keyword-extractor 0.0.28
- **Date Handling**: date-fns 4.1.0
- **Document Processing**: Mammoth 1.11.0

## 📁 Project Structure

```
IT-Museum/
├── src/
│   ├── components/           # Reusable React components
│   │   ├── admin/           # Admin-specific components
│   │   │   ├── KeywordExtractor.tsx
│   │   │   └── ReviewPanel.tsx
│   │   ├── DynamicCollections.tsx
│   │   ├── DynamicHomeSections.tsx
│   │   ├── Footer.tsx
│   │   ├── Header.tsx
│   │   ├── HeroSlideshow.tsx
│   │   └── Layout.tsx
│   ├── pages/               # Page components
│   │   ├── Admin.tsx        # Multi-panel admin dashboard
│   │   ├── Article.tsx      # Individual article view
│   │   ├── Collection.tsx   # Published articles display
│   │   ├── Contact.tsx      # Contact form
│   │   ├── Home.tsx         # Landing page
│   │   ├── Submission.tsx   # Article submission form
│   │   └── Team.tsx         # Team members page
│   ├── services/            # API and data services
│   │   ├── articleService.ts    # Article CRUD operations
│   │   └── contentService.ts    # Content management
│   ├── hooks/               # Custom React hooks
│   │   └── useScrollAnimation.ts
│   ├── lib/                 # External integrations
│   │   └── supabase.ts      # Supabase client
│   ├── assets/              # Static assets
│   │   ├── hero-images/     # Hero slideshow images
│   │   └── *.png            # Logos and branding
│   ├── firebase-config.ts   # Firebase configuration
│   ├── index.css            # Global styles
│   ├── App.tsx              # Root component
│   └── main.tsx             # Application entry point
├── .env                     # Environment variables
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite configuration
└── index.html               # HTML template
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Firebase account
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/itmuseum-christuniversity/IT-Museum.git
   cd IT-Museum
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open browser**
   
   Navigate to `http://localhost:5173`

### Build for Production

```bash
npm run build
npm run preview
```

## ⚙️ Configuration

### Firebase Configuration

Update `src/firebase-config.ts` with your Firebase credentials:

```typescript
const firebaseConfig = {
    apiKey: "your_api_key",
    authDomain: "your_project.firebaseapp.com",
    projectId: "your_project_id",
    storageBucket: "your_project.firebasestorage.app",
    messagingSenderId: "your_sender_id",
    appId: "your_app_id",
    measurementId: "your_measurement_id"
};
```

### Supabase Database Schema

#### Articles Table

```sql
CREATE TABLE articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    author_name TEXT NOT NULL,
    institution_email TEXT NOT NULL,
    abstract TEXT NOT NULL,
    file_url TEXT,
    status TEXT NOT NULL DEFAULT 'submitted',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tags TEXT[]
);
```

**Status Values**:
- `submitted` - Initial submission
- `approved_first` - First review approved
- `approved_technical` - Technical review approved
- `approved_literature` - Literature review approved
- `ready_for_publishing` - Ready for main admin
- `accepted` / `published` - Published articles
- `rejected` - Rejected submissions

#### Sections Table

```sql
CREATE TABLE sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT,
    content TEXT,
    order INTEGER,
    image_url TEXT,
    pdf_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Admin Credentials

Configure admin access in `src/pages/Admin.tsx`:

```typescript
const adminCredentials = {
    MAIN_ADMIN: {
        email: 'admin@christuniversity.in',
        password: 'admin123'
    },
    FIRST_REVIEW: {
        email: 'firstreview@christuniversity.in',
        password: 'first123'
    },
    TECHNICAL_TEAM: {
        email: 'technical@christuniversity.in',
        password: 'tech123'
    },
    LITERATURE_REVIEW: {
        email: 'literature@christuniversity.in',
        password: 'lit123'
    }
};
```

## 🔄 Multi-Stage Review Workflow

The application implements a sophisticated four-tier review system:

```
Article Submission
       ↓
First Review Panel → (approved_first)
       ↓
Technical Team Review → (approved_technical)
       ↓
Literature Review Panel → (approved_literature)
       ↓
Main Admin Dashboard → (ready_for_publishing)
       ↓
Published (accepted/published)
```

### Review Panel Features

Each review panel can:
- ✏️ **Edit** article title and abstract
- ✅ **Approve** to move to next stage
- ⛔ **Reject** with reason
- 🔗 **Access** Google Docs submissions
- 🔔 **View** notifications and activity

### Reviewer Accounts

1. **First Review Panel**: Initial content review
2. **Technical Team**: Technical accuracy verification
3. **Literature Review**: Academic and citation review
4. **Main Admin**: Final approval and publishing

## 📝 Article Submission Process

1. **Submitter** fills out the submission form with:
   - Title
   - Author name
   - Institutional email
   - Abstract (150-500 characters)
   - Google Docs URL (shareable link)

2. **Validation**: Real-time URL validation and character counting

3. **Submission**: Article enters the review pipeline with status `submitted`

4. **Review Process**: Sequential approval through all review stages

5. **Publication**: Final admin approval makes article visible on Collection page

## 🎨 Design System

### Color Palette

```css
--primary: #1a4d7c;        /* Deep Blue */
--primary-light: #2563a8;
--secondary: #c49a3c;      /* Gold */
--accent: #c49a3c;
--text: #2c3e50;
--text-muted: #546e7a;
--bg-light: #f5f7fa;
--bg-card: #ffffff;
```

### Typography

- **Font Family**: Raleway
- **Base Weight**: 600 (SemiBold)
- **Headings**: 700-800
- **Body**: 400-600

### Animations

- Fade-in effects on scroll
- Hover transformations
- Glassmorphism effects
- Smooth transitions (0.3s ease)

## 🚢 Deployment

### Vite Build

```bash
npm run build
```

The production build will be in the `dist/` directory.

### Hosting Options

- **Firebase Hosting**: Recommended for seamless integration
- **Vercel**: Zero-configuration deployment
- **Netlify**: Continuous deployment from Git
- **GitHub Pages**: Free static hosting

### Firebase Hosting Steps

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy
```

## 🤝 Contributing

### Article Submission

1. Visit the Submission page
2. Fill out the form with article details
3. Provide a shareable Google Docs link
4. Submit for review

### Code Contributions

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Contact

- **Institution**: Christ University
- **Repository**: [github.com/itmuseum-christuniversity/IT-Museum](https://github.com/itmuseum-christuniversity/IT-Museum)
- **Issues**: [GitHub Issues](https://github.com/itmuseum-christuniversity/IT-Museum/issues)

## 📄 License

This project is maintained by Christ University for academic and cultural preservation purposes.

---

**Built with ❤️ by Christ University | Preserving Heritage Through Technology**
