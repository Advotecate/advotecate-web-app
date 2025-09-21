# 🎨 Advotecate Complete Style Guide

A comprehensive guide to all colors, fonts, icons, and brand elements used in the Advotecate platform. Use this guide to replicate the design system in other projects.

---

## 🎯 **Color System**

### **Primary Brand Colors (Mint Green Palette)**
```css
/* Main Mint Colors */
--mint-50: #F3FDFB;     /* Lightest mint - backgrounds */
--mint-100: #E9FBF6;    /* Light mint - subtle accents */
--mint-400: #4DCAA1;    /* Medium mint */
--mint-500: #3EB489;    /* Standard mint */
--mint-600: #3EB489;    /* Primary brand color */
--mint-700: #359A77;    /* Darker mint - hover states */
--mint-800: #2D7F63;    /* Deep mint */
--mint-900: #25654F;    /* Darkest mint */
```

### **Secondary Colors**
```css
/* Accent Colors */
--blue: #365EBF;        /* Links, data viz */
--success: #02cb97;     /* Success states */
--error: #ef4444;       /* Error states */
--warning: #f59e0b;     /* Warning states */

/* Additional Accent Colors */
--primary-blue: #3B82F6;
--success-green: #10B981;
--accent-purple: #8B5CF6;
```

### **Neutral Colors**
```css
/* Text Colors */
--ink: #111827;         /* Primary headings */
--body: #374151;        /* Body text */
--muted: #6B7280;       /* Secondary text */

/* Surface Colors */
--surface: #FFFFFF;           /* Main backgrounds */
--surface-subtle: #F8FAFC;   /* Subtle backgrounds */
--line: #E5E7EB;             /* Borders & dividers */
--light-bg: #F9FAFB;         /* Light backgrounds */
--dark-bg: #0F172A;          /* Dark mode backgrounds */
```

### **Gray Scale**
```css
--gray-50: #f9fafb;
--gray-100: #f3f4f6;
--gray-200: #e5e7eb;
--gray-300: #d1d5db;
--gray-400: #9ca3af;
--gray-500: #6b7280;
--gray-600: #4b5563;
--gray-700: #374151;
--gray-800: #1f2937;
--gray-900: #111827;
```

### **Glassmorphism Effects**
```css
/* Glass Backgrounds */
--glass-bg: rgba(255, 255, 255, 0.85);
--glass-bg-dark: rgba(255, 255, 255, 0.1);
--glass-border: rgba(255, 255, 255, 0.2);

/* Glass Shadows */
--glass-shadow: 0 8px 32px rgba(17, 24, 39, 0.12);
--glass-shadow-lg: 0 20px 60px rgba(17, 24, 39, 0.15);

/* Backdrop Effects */
--backdrop-blur: blur(16px);
--backdrop-blur-sm: blur(8px);
```

---

## 🔤 **Typography System**

### **Font Families**
```css
/* Import from Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500&family=Figtree:wght@400;500&display=swap');

/* Font Variables */
--font-heading: 'Poppins', system-ui, sans-serif;  /* Headings */
--font-body: 'Figtree', system-ui, sans-serif;     /* Body text */
--font-sans: 'Figtree', system-ui, sans-serif;     /* Default */
```

### **Font Weights**
```css
/* Poppins Weights */
font-weight: 300;  /* Light */
font-weight: 400;  /* Regular */
font-weight: 500;  /* Medium */

/* Figtree Weights */
font-weight: 400;  /* Regular */
font-weight: 500;  /* Medium */
```

### **Typography Scale**
```css
/* Headings */
h1 {
  font-size: 48px;
  line-height: 56px;
  font-weight: 500;
  letter-spacing: -0.025em;
}

h2 {
  font-size: 36px;
  line-height: 44px;
  font-weight: 500;
  letter-spacing: -0.025em;
}

h3 {
  font-size: 28px;
  line-height: 36px;
  font-weight: 500;
  letter-spacing: -0.015em;
}

h4 {
  font-size: 22px;
  line-height: 30px;
  font-weight: 500;
}

/* Body Text */
body {
  font-size: 16px;
  line-height: 1.6;
}

/* Tailwind Extended Sizes */
text-7xl: 4.5rem
text-8xl: 6rem
text-9xl: 8rem
```

---

## 🎭 **Icon Library**

### **Primary Icon Library: Lucide React**
```bash
npm install lucide-react
```

### **Icon Sizing System**
```typescript
// Icon sizes
16px (w-4 h-4)   // Small icons
20px (w-5 h-5)   // Standard UI icons  
24px (w-6 h-6)   // Large UI icons
64px (w-16 h-16) // Hero/decorative icons

// Stroke Width
strokeWidth={1.5} // Standard UI icons
strokeWidth={1}   // Decorative/large icons
```

### **Commonly Used Icons**
```typescript
// Navigation & UI
import { 
  // Navigation
  ChartBar,        // Dashboard
  Users,           // People/Community
  Calendar,        // Events
  MessageSquare,   // Outreach/Messages
  Settings,        // Settings
  Search,          // Search
  Filter,          // Filter
  
  // Actions
  Plus,            // Add/Create
  Edit,            // Edit
  Trash2,          // Delete
  Save,            // Save
  X,               // Cancel/Close
  ChevronRight,    // Next
  ChevronLeft,     // Previous
  ChevronDown,     // Expand
  ArrowRight,      // Go/Navigate
  ExternalLink,    // External link
  Share2,          // Share
  
  // Status & Feedback
  Check,           // Success/Complete
  CheckCircle,     // Success state
  AlertCircle,     // Warning
  XCircle,         // Error
  Info,            // Information
  Loader2,         // Loading
  
  // Social & Engagement
  Heart,           // Like/Favorite
  MessageCircle,   // Comments
  ThumbsUp,        // Upvote
  ThumbsDown,      // Downvote
  Star,            // Rating/Favorite
  Award,           // Achievement
  
  // Content Types
  FileText,        // Document
  BookOpen,        // Education
  Briefcase,       // Work/Business
  GraduationCap,   // Education
  Vote,            // Voting/Politics
  Megaphone,       // Announcements
  
  // Location & Time
  MapPin,          // Location
  Clock,           // Time
  Calendar,        // Date
  
  // Categories
  Building,        // Organization
  Home,            // Housing
  Shield,          // Security/Protection
  Globe,           // Global/World
  Leaf,            // Environment
  Scale,           // Justice/Legal
  Gavel,           // Law/Legal
  DollarSign,      // Finance
  
  // Data & Analytics
  TrendingUp,      // Growth/Trending
  Activity,        // Activity/Stats
  Zap,             // Energy/Quick
  Sparkles,        // Featured/Special
  
  // User & Account
  User,            // Single user
  Users2,          // Multiple users
  UserPlus,        // Add user
  Phone,           // Contact
  
  // Misc
  Lightbulb,       // Ideas
  HeartHandshake,  // Partnership
  Flag,            // Report/Flag
  Eye,             // View
  Compass,         // Navigate/Explore
  Bookmark         // Save/Bookmark
} from 'lucide-react'
```

### **Social Media Icons (FontAwesome)**
```typescript
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTwitter, faFacebook, faInstagram, faLinkedin } from '@fortawesome/free-brands-svg-icons'
```

---

## 🎨 **Component Styles**

### **Buttons**

#### Primary Button (Mint Gradient)
```css
.btn-primary {
  background: linear-gradient(135deg, #02cb97 0%, #3EB489 100%);
  color: white;
  padding: 12px 24px;
  border-radius: 16px;
  font-weight: 500;
  box-shadow: 0 4px 16px rgba(2, 203, 151, 0.25);
  transition: all 0.3s ease;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #3EB489 0%, #359A77 100%);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(2, 203, 151, 0.3);
}
```

#### Secondary Button
```css
.btn-secondary {
  background: white;
  color: #111827;
  padding: 12px 24px;
  border-radius: 16px;
  border: 1px solid #E5E7EB;
  font-weight: 500;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  transition: all 0.3s ease;
}

.btn-secondary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  border-color: #3EB489;
}
```

#### Blue Button
```css
.btn-blue {
  background: #365EBF;
  color: white;
  padding: 12px 24px;
  border-radius: 16px;
  font-weight: 500;
  box-shadow: 0 4px 16px rgba(54, 94, 191, 0.25);
  transition: all 0.3s ease;
}

.btn-blue:hover {
  background: #2d4a99;
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(54, 94, 191, 0.3);
}
```

### **Cards**
```css
.card {
  background: white;
  border-radius: 20px;
  border: 1px solid #E5E7EB;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04), 
              0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
  overflow: hidden;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08), 
              0 4px 16px rgba(0, 0, 0, 0.1);
}

.card-subtle {
  background: #F3FDFB;
  border-color: #E9FBF6;
}
```

### **Form Elements**

#### Input Fields
```css
.form-input {
  width: 100%;
  padding: 16px 20px;
  background: white;
  border: 1px solid #E5E7EB;
  border-radius: 16px;
  font-size: 16px;
  color: #374151;
  transition: all 0.3s ease;
}

.form-input:focus {
  outline: none;
  border-color: #3EB489;
  box-shadow: 0 0 0 3px #E9FBF6;
}
```

#### Select Dropdowns
```css
.form-select {
  width: 100%;
  padding: 16px 20px;
  background: white;
  border: 1px solid #E5E7EB;
  border-radius: 16px;
  cursor: pointer;
  font-size: 16px;
  color: #374151;
  transition: all 0.3s ease;
}
```

### **Navigation Styles**

#### Glass Navigation
```css
.glass-nav {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px rgba(17, 24, 39, 0.1), 
              0 1px 0 rgba(255, 255, 255, 0.5) inset;
}

.glass-nav-mint {
  background: rgba(62, 180, 137, 0.8);
  backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px rgba(62, 180, 137, 0.2), 
              0 1px 0 rgba(255, 255, 255, 0.3) inset;
}
```

---

## 🎬 **Animations**

### **Fade Animations**
```css
.animate-fade-in {
  animation: fadeIn 0.6s ease-out;
}

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
```

### **Slide Animations**
```css
.animate-slide-up {
  animation: slideUp 0.4s ease-out;
}

@keyframes slideUp {
  from { 
    opacity: 0; 
    transform: translateY(40px); 
  }
  to { 
    opacity: 1; 
    transform: translateY(0); 
  }
}
```

### **Float Animations**
```css
.animate-float {
  animation: float 6s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
}
```

### **Glassmorphic Background Animations**
```css
/* Slow floating animation */
.animate-float-slow {
  animation: float-slow 20s ease-in-out infinite;
}

@keyframes float-slow {
  0%, 100% { transform: translate(0px, 0px) scale(1); }
  33% { transform: translate(30px, -30px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
}

/* Reverse floating */
.animate-float-reverse {
  animation: float-reverse 25s ease-in-out infinite;
}

/* Diagonal floating */
.animate-float-diagonal {
  animation: float-diagonal 18s ease-in-out infinite;
}

/* Slow pulse */
.animate-pulse-slow {
  animation: pulse-slow 8s ease-in-out infinite;
}
```

---

## 📐 **Spacing & Layout**

### **Border Radius**
```css
--radius: 14px;           /* Default radius */
--radius-button: 16px;    /* Button radius */
--radius-card: 20px;      /* Card radius */
```

### **Shadows**
```css
/* Brand Shadows */
--shadow-sm: 0 1px 2px rgba(17, 24, 39, 0.06);
--shadow-md: 0 8px 24px rgba(17, 24, 39, 0.08);
--shadow-brand: 0 8px 24px rgba(17, 24, 39, 0.08);

/* Mint Shadows */
--shadow-mint: 0 4px 16px rgba(2, 203, 151, 0.25), 
               0 2px 8px rgba(2, 203, 151, 0.15);
--shadow-mint-lg: 0 6px 20px rgba(2, 203, 151, 0.3), 
                  0 4px 12px rgba(2, 203, 151, 0.2);

/* Glass Shadows */
--shadow-glass: 0 8px 32px rgba(17, 24, 39, 0.12);
--shadow-glass-lg: 0 20px 60px rgba(17, 24, 39, 0.15);

/* Card Shadows */
--shadow-card: 0 4px 20px rgba(0, 0, 0, 0.04), 
               0 2px 8px rgba(0, 0, 0, 0.06), 
               inset 0 1px 0 rgba(255, 255, 255, 0.7);
--shadow-card-hover: 0 8px 32px rgba(0, 0, 0, 0.08), 
                     0 4px 16px rgba(0, 0, 0, 0.1);
```

### **Custom Spacing**
```css
/* Additional spacing values */
spacing-18: 4.5rem;   /* 72px */
spacing-88: 22rem;    /* 352px */
spacing-128: 32rem;   /* 512px */
```

---

## 📱 **Responsive Breakpoints**

```css
/* Mobile First Approach */
xs: 0px+      /* Extra small devices */
sm: 640px+    /* Small devices */
md: 768px+    /* Medium devices */
lg: 1024px+   /* Large devices */
xl: 1280px+   /* Extra large devices */
2xl: 1536px+  /* 2X large devices */
```

---

## 🏠 **Brand Assets**

### **Logo Files**
```
/public/logos/
├── advotecate-logo.png      # Main logo
├── cropped-logo-sq.png      # Square logo
└── cropped-logo-sq.webp     # Square logo (WebP)
```

### **Placeholder Images**
```
/public/placeholder_images/
├── Avatar Images
│   ├── avatar_female.png
│   └── avatar_male.png
│
├── Bill Images
│   ├── bill-democracy.jpg
│   ├── bill-education.jpg
│   ├── bill-energy.jpg
│   ├── bill-farmers.jpg
│   ├── bill-health.jpg
│   ├── bill-housing.jpg
│   ├── bill-medicare.jpg
│   ├── bill-millions.jpg
│   ├── bill-transparency.jpg
│   └── bill-wages.jpg
│
├── Event Images
│   ├── canvassing-training.jpg
│   ├── civic-tech.jpg
│   ├── climate-gala.jpg
│   ├── climate-workshop.jpg
│   ├── comm-garden.jpg
│   ├── education-rally.jpg
│   ├── healthcare-forum.jpg
│   ├── mobile-health-clinic.jpg
│   ├── phone-bank.jpg
│   ├── town-hall.jpg
│   ├── volunteer-meetup.jpg
│   └── womens-activism.jpg
│
├── Organization Images
│   ├── org-dallaswater.jpg
│   ├── org-education.jpg
│   ├── org-green.jpg
│   ├── org-health.jpg
│   ├── org-houstonenergy.jpg
│   ├── org-houstonhealth.jpg
│   ├── org-progressive.jpg
│   └── org-texdem.jpg
│
└── Fundraiser Images
    ├── progressive-research-fund.jpg
    ├── school-supplies-fund.jpg
    ├── solar-community-fund.jpg
    └── texas-democrats-2026.jpg
```

---

## 🎯 **Brand Voice & Guidelines**

### **Design Principles**
- **Clean & Modern**: Minimalist design with focus on content
- **Soft & Approachable**: Rounded corners (16-20px), soft shadows
- **Mint Green Identity**: Primary brand color throughout
- **Glass Effects**: Subtle glassmorphism for depth
- **Smooth Transitions**: 0.3s ease transitions on all interactions

### **Color Usage Guidelines**
- **Primary Actions**: Mint green (#3EB489)
- **Secondary Actions**: White with border
- **Links**: Blue (#365EBF)
- **Success States**: Success green (#02cb97)
- **Error States**: Red (#ef4444)
- **Warning States**: Orange (#f59e0b)

### **Typography Guidelines**
- **Headings**: Poppins, weight 500, reduced letter-spacing
- **Body Text**: Figtree, weight 400, line-height 1.6
- **Important Text**: Figtree, weight 500
- **All Caps**: Avoid except for small labels

### **Icon Guidelines**
- **Consistent Size**: Use standard sizes (16px, 20px, 24px)
- **Stroke Width**: 1.5 for UI, 1 for decorative
- **Color**: Match text color or use brand colors
- **Alignment**: Center align with text baseline

---

## 🛠 **Implementation Checklist**

### **Dependencies to Install**
```json
{
  "dependencies": {
    "react": "^18.0.0",
    "lucide-react": "latest",
    "@fortawesome/react-fontawesome": "latest",
    "@fortawesome/free-brands-svg-icons": "latest"
  },
  "devDependencies": {
    "tailwindcss": "^3.0.0",
    "postcss": "^8.0.0",
    "autoprefixer": "^10.0.0"
  }
}
```

### **CSS Setup**
1. Import Google Fonts (Poppins + Figtree)
2. Set up CSS variables for colors
3. Configure Tailwind with custom theme
4. Add utility classes for buttons, cards, forms
5. Implement animation keyframes

### **Component Structure**
```
components/
├── buttons/        # Button components
├── cards/          # Card components
├── forms/          # Form elements
├── navigation/     # Navigation components
├── layout/         # Layout components
└── shared/         # Shared/utility components
```

---

## 📋 **Quick Reference**

### **Most Used Classes**
```css
/* Buttons */
.btn-primary
.btn-secondary
.btn-blue

/* Cards */
.card
.card-subtle
.card:hover

/* Forms */
.form-input
.form-select

/* Navigation */
.glass-nav
.glass-nav-mint

/* Animations */
.animate-fade-in
.animate-slide-up
.animate-float

/* Colors */
.text-mint-600
.bg-mint-100
.border-mint-600

/* Spacing */
.p-6
.rounded-card
.shadow-mint
```

### **Common Component Patterns**
```jsx
// Primary Button
<button className="btn-primary">
  <Plus className="w-5 h-5 mr-2" />
  Create New
</button>

// Card Component
<div className="card p-6">
  <h3 className="text-xl font-heading font-medium text-ink mb-2">
    Card Title
  </h3>
  <p className="text-body">Card content...</p>
</div>

// Form Input
<input 
  type="text" 
  className="form-input"
  placeholder="Enter text..."
/>

// Icon Usage
<Calendar className="w-6 h-6 text-mint-600" strokeWidth={1.5} />
```

---

This comprehensive style guide provides everything needed to replicate the Advotecate design system. The design emphasizes a modern, clean aesthetic with mint green as the primary brand color, soft shadows, generous border radius, and subtle glassmorphism effects.
