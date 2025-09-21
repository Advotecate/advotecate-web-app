# React/Next.js Frontend Architecture

## Overview

Comprehensive frontend architecture for the political donation platform using Next.js 14 with App Router, optimized for performance, accessibility, and compliance with political campaign finance regulations.

## Technology Stack

### Core Framework
- **Next.js 14**: App Router, Server Components, Server Actions
- **React 18**: Concurrent features, Suspense, Error Boundaries
- **TypeScript**: Strict type checking for reliability

### State Management & Data Fetching
- **TanStack Query (React Query)**: Server state management and caching
- **Zustand**: Client-side state management
- **SWR**: Real-time data synchronization for critical updates

### Styling & UI Components
- **Tailwind CSS**: Utility-first CSS framework
- **Headless UI**: Accessible UI components
- **Framer Motion**: Animations and transitions
- **Lucide React**: Icon library

### Forms & Validation
- **React Hook Form**: Performant form handling
- **Zod**: Runtime type validation and schema parsing
- **React-Select**: Advanced select components for donor/organization selection

### Authentication & Security
- **NextAuth.js**: Authentication solution
- **jose**: JWT handling and validation
- **crypto-js**: Client-side encryption utilities

## Project Structure

```
frontend/
├── app/                          # Next.js 14 App Router
│   ├── (auth)/                   # Auth route group
│   │   ├── login/
│   │   ├── register/
│   │   └── forgot-password/
│   ├── (dashboard)/              # Protected dashboard routes
│   │   ├── admin/               # Admin interface
│   │   ├── donor/               # Donor portal
│   │   └── organization/        # Organization management
│   ├── api/                     # API routes
│   │   ├── auth/
│   │   ├── donations/
│   │   └── compliance/
│   ├── donate/                  # Public donation pages
│   │   └── [slug]/             # Dynamic fundraiser pages
│   ├── globals.css
│   ├── layout.tsx              # Root layout
│   ├── loading.tsx             # Loading UI
│   └── not-found.tsx           # 404 page
├── components/                  # Reusable components
│   ├── ui/                     # Base UI components
│   ├── forms/                  # Form components
│   ├── layouts/                # Layout components
│   ├── donation/               # Donation-specific components
│   ├── compliance/             # Compliance-related components
│   └── admin/                  # Admin-specific components
├── lib/                        # Utilities and configurations
│   ├── auth.ts                 # Authentication configuration
│   ├── api.ts                  # API client configuration
│   ├── validations.ts          # Zod schemas
│   ├── compliance.ts           # Compliance utilities
│   └── utils.ts                # General utilities
├── hooks/                      # Custom React hooks
│   ├── use-donations.ts
│   ├── use-compliance.ts
│   └── use-auth.ts
├── store/                      # Global state management
│   ├── auth-store.ts
│   ├── donation-store.ts
│   └── ui-store.ts
├── types/                      # TypeScript type definitions
│   ├── api.ts
│   ├── auth.ts
│   ├── donation.ts
│   └── compliance.ts
└── public/                     # Static assets
    ├── images/
    ├── icons/
    └── manifest.json
```

## Core Architecture Patterns

### 1. Server Components + Client Components Strategy

```tsx
// app/donate/[slug]/page.tsx (Server Component)
import { getFundraiser, getOrganization } from '@/lib/api';
import { DonationForm } from '@/components/donation/donation-form';
import { FundraiserDetails } from '@/components/fundraiser/fundraiser-details';

interface DonatePageProps {
  params: { slug: string };
  searchParams: { amount?: string; recurring?: string };
}

export default async function DonatePage({ params, searchParams }: DonatePageProps) {
  // Server-side data fetching
  const [fundraiser, organization] = await Promise.all([
    getFundraiser(params.slug),
    getOrganization(fundraiser.organizationId)
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Server Component - SEO optimized */}
        <FundraiserDetails
          fundraiser={fundraiser}
          organization={organization}
        />

        {/* Client Component - Interactive form */}
        <DonationForm
          fundraiser={fundraiser}
          organization={organization}
          initialAmount={searchParams.amount}
          initialRecurring={searchParams.recurring === 'true'}
        />
      </div>
    </div>
  );
}

// Generate metadata for SEO
export async function generateMetadata({ params }: DonatePageProps) {
  const fundraiser = await getFundraiser(params.slug);

  return {
    title: `Donate to ${fundraiser.title}`,
    description: fundraiser.description.substring(0, 160),
    openGraph: {
      title: `Support ${fundraiser.title}`,
      description: fundraiser.description,
      images: [fundraiser.imageUrl],
      type: 'website',
    },
  };
}
```

### 2. Form Architecture with Validation

```tsx
// components/forms/donation-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { donationSchema, type DonationFormData } from '@/lib/validations';
import { useComplianceCheck } from '@/hooks/use-compliance';

interface DonationFormProps {
  fundraiser: Fundraiser;
  organization: Organization;
  initialAmount?: string;
  initialRecurring?: boolean;
}

export function DonationForm({
  fundraiser,
  organization,
  initialAmount,
  initialRecurring
}: DonationFormProps) {
  const form = useForm<DonationFormData>({
    resolver: zodResolver(donationSchema),
    defaultValues: {
      amount: initialAmount ? parseFloat(initialAmount) : undefined,
      recurring: initialRecurring ?? false,
      frequency: 'monthly',
      // Donor information
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      // Compliance fields
      employer: '',
      occupation: '',
    },
  });

  // Real-time compliance checking
  const { data: complianceCheck, isLoading: isCheckingCompliance } =
    useComplianceCheck({
      amount: form.watch('amount'),
      organizationId: organization.id,
      userId: form.watch('email'), // Use email as identifier for guest donors
    });

  const donationMutation = useMutation({
    mutationFn: async (data: DonationFormData) => {
      // First, create or get donor profile
      const donor = await createOrUpdateDonor(data);

      // Process donation through FluidPay
      return processDonation({
        ...data,
        donorId: donor.id,
        fundraiserId: fundraiser.id,
        organizationId: organization.id,
      });
    },
    onSuccess: (result) => {
      // Redirect to success page
      router.push(`/donate/success?id=${result.donationId}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (data: DonationFormData) => {
    donationMutation.mutate(data);
  };

  return (
    <Card className="p-6">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Amount Selection */}
        <AmountSelector
          value={form.watch('amount')}
          onChange={(amount) => form.setValue('amount', amount)}
          suggestedAmounts={fundraiser.suggestedAmounts}
          maxAmount={complianceCheck?.remainingLimit}
        />

        {/* Recurring Options */}
        <RecurringToggle
          enabled={form.watch('recurring')}
          frequency={form.watch('frequency')}
          onEnabledChange={(enabled) => form.setValue('recurring', enabled)}
          onFrequencyChange={(freq) => form.setValue('frequency', freq)}
        />

        {/* Donor Information */}
        <DonorInformation form={form} />

        {/* Compliance Information */}
        {(complianceCheck?.requiresEmployerInfo || form.watch('amount') >= 200) && (
          <ComplianceInformation form={form} />
        )}

        {/* Payment Method */}
        <PaymentMethodSelector
          onMethodSelected={(method) => form.setValue('paymentMethod', method)}
        />

        {/* Compliance Warnings */}
        {complianceCheck?.warnings?.map((warning, index) => (
          <Alert key={index} variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{warning}</AlertDescription>
          </Alert>
        ))}

        <Button
          type="submit"
          disabled={donationMutation.isPending || isCheckingCompliance}
          className="w-full"
        >
          {donationMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing Donation...
            </>
          ) : (
            `Donate $${form.watch('amount') || 0}`
          )}
        </Button>
      </form>
    </Card>
  );
}
```

### 3. State Management Architecture

```tsx
// store/donation-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DonationState {
  // Current donation session
  currentDonation: {
    fundraiserId?: string;
    amount?: number;
    recurring?: boolean;
    paymentMethodId?: string;
  };

  // Donor information (for guest checkouts)
  guestDonor: {
    firstName?: string;
    lastName?: string;
    email?: string;
    // ... other fields
  };

  // Actions
  setDonationAmount: (amount: number) => void;
  setRecurring: (recurring: boolean) => void;
  setGuestDonorInfo: (info: Partial<typeof this.guestDonor>) => void;
  clearDonation: () => void;
}

export const useDonationStore = create<DonationState>()(
  persist(
    (set, get) => ({
      currentDonation: {},
      guestDonor: {},

      setDonationAmount: (amount) =>
        set((state) => ({
          currentDonation: { ...state.currentDonation, amount },
        })),

      setRecurring: (recurring) =>
        set((state) => ({
          currentDonation: { ...state.currentDonation, recurring },
        })),

      setGuestDonorInfo: (info) =>
        set((state) => ({
          guestDonor: { ...state.guestDonor, ...info },
        })),

      clearDonation: () =>
        set({ currentDonation: {}, guestDonor: {} }),
    }),
    {
      name: 'donation-store',
      // Only persist non-sensitive data
      partialize: (state) => ({
        currentDonation: {
          fundraiserId: state.currentDonation.fundraiserId,
          amount: state.currentDonation.amount,
          recurring: state.currentDonation.recurring,
        },
      }),
    }
  )
);
```

### 4. API Layer Architecture

```tsx
// lib/api.ts
import { QueryClient } from '@tanstack/react-query';

class APIClient {
  private baseURL: string;
  private headers: HeadersInit;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || '/api';
    this.headers = {
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const response = await fetch(url, {
      headers: { ...this.headers, ...options.headers },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new APIError(error.message || 'Request failed', response.status);
    }

    return response.json();
  }

  // Donation endpoints
  async createDonation(data: CreateDonationRequest): Promise<Donation> {
    return this.request('/donations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getDonation(id: string): Promise<Donation> {
    return this.request(`/donations/${id}`);
  }

  async getFundraiser(slug: string): Promise<Fundraiser> {
    return this.request(`/fundraisers/${slug}`);
  }

  async checkCompliance(data: ComplianceCheckRequest): Promise<ComplianceResult> {
    return this.request('/compliance/check', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const apiClient = new APIClient();

// React Query hooks
export function useDonation(id: string) {
  return useQuery({
    queryKey: ['donation', id],
    queryFn: () => apiClient.getDonation(id),
    enabled: !!id,
  });
}

export function useFundraiser(slug: string) {
  return useQuery({
    queryKey: ['fundraiser', slug],
    queryFn: () => apiClient.getFundraiser(slug),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

## Component Library Architecture

### 1. Base UI Components

```tsx
// components/ui/button.tsx
import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        donate: "bg-green-600 text-white hover:bg-green-700 text-lg px-8 py-3",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

### 2. Donation-Specific Components

```tsx
// components/donation/amount-selector.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface AmountSelectorProps {
  value?: number;
  onChange: (amount: number) => void;
  suggestedAmounts?: number[];
  maxAmount?: number;
  className?: string;
}

export function AmountSelector({
  value,
  onChange,
  suggestedAmounts = [25, 50, 100, 250, 500, 1000],
  maxAmount,
  className,
}: AmountSelectorProps) {
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  const handleSuggestedAmount = (amount: number) => {
    setIsCustom(false);
    setCustomAmount('');
    onChange(amount);
  };

  const handleCustomAmount = (amount: string) => {
    const numAmount = parseFloat(amount);
    if (!isNaN(numAmount) && numAmount > 0) {
      setIsCustom(true);
      setCustomAmount(amount);
      onChange(numAmount);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-3 gap-3">
        {suggestedAmounts.map((amount) => (
          <Button
            key={amount}
            type="button"
            variant={value === amount && !isCustom ? "default" : "outline"}
            onClick={() => handleSuggestedAmount(amount)}
            disabled={maxAmount && amount > maxAmount}
            className="text-center"
          >
            ${amount}
          </Button>
        ))}
      </div>

      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
          $
        </div>
        <Input
          type="number"
          placeholder="Other amount"
          value={customAmount}
          onChange={(e) => handleCustomAmount(e.target.value)}
          className="pl-8"
          min="1"
          max={maxAmount}
        />
      </div>

      {maxAmount && value && value > maxAmount && (
        <p className="text-sm text-red-600">
          Maximum donation amount is ${maxAmount.toLocaleString()}
        </p>
      )}
    </div>
  );
}
```

### 3. Compliance Components

```tsx
// components/compliance/compliance-checker.tsx
'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface ComplianceCheckerProps {
  amount?: number;
  donorInfo: {
    email?: string;
    firstName?: string;
    lastName?: string;
  };
  organizationId: string;
  onComplianceResult: (result: ComplianceResult) => void;
}

export function ComplianceChecker({
  amount,
  donorInfo,
  organizationId,
  onComplianceResult,
}: ComplianceCheckerProps) {
  const { data: complianceResult, isLoading, error } = useQuery({
    queryKey: ['compliance', amount, donorInfo.email, organizationId],
    queryFn: () =>
      apiClient.checkCompliance({
        amount: amount || 0,
        donorIdentifier: donorInfo.email || '',
        organizationId,
        donorInfo,
      }),
    enabled: !!(amount && amount > 0 && donorInfo.email && organizationId),
    refetchInterval: 30000, // Re-check every 30 seconds for limit updates
  });

  useEffect(() => {
    if (complianceResult) {
      onComplianceResult(complianceResult);
    }
  }, [complianceResult, onComplianceResult]);

  if (!amount || amount <= 0) return null;

  if (isLoading) {
    return (
      <Alert>
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertDescription>Checking contribution limits...</AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Unable to verify contribution limits. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (!complianceResult?.allowed) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {complianceResult?.reason || 'This contribution is not allowed.'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-2">
      {complianceResult.allowed && (
        <Alert>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Contribution verified and compliant.
            {complianceResult.remainingLimit && (
              <>
                {' '}
                Remaining limit: ${complianceResult.remainingLimit.toLocaleString()}
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {complianceResult.warnings?.map((warning, index) => (
        <Alert key={index} variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      ))}

      {complianceResult.disclosureRequired && (
        <Alert>
          <AlertDescription className="text-sm text-gray-600">
            This contribution requires disclosure of employer and occupation information.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
```

## Authentication Architecture

### 1. NextAuth.js Configuration

```tsx
// lib/auth.ts
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/password';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: { strategy: 'jwt' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email },
          include: { organizationUsers: { include: { organization: true } } },
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await verifyPassword(credentials.password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          kycStatus: user.kycStatus,
          organizations: user.organizationUsers.map(ou => ou.organization),
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.role = user.role;
        token.kycStatus = user.kycStatus;
        token.organizations = user.organizations;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!;
        session.user.role = token.role as string;
        session.user.kycStatus = token.kycStatus as string;
        session.user.organizations = token.organizations as any[];
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    signUp: '/register',
    error: '/auth/error',
  },
};
```

### 2. Protected Route Components

```tsx
// components/auth/protected-route.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string[];
  requiredKycStatus?: string[];
  fallbackUrl?: string;
}

export function ProtectedRoute({
  children,
  requiredRole = [],
  requiredKycStatus = [],
  fallbackUrl = '/login',
}: ProtectedRouteProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push(fallbackUrl);
      return;
    }

    if (requiredRole.length > 0 && !requiredRole.includes(session.user.role)) {
      router.push('/unauthorized');
      return;
    }

    if (
      requiredKycStatus.length > 0 &&
      !requiredKycStatus.includes(session.user.kycStatus)
    ) {
      router.push('/kyc/verify');
      return;
    }
  }, [session, status, router, requiredRole, requiredKycStatus, fallbackUrl]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  return <>{children}</>;
}
```

## Performance Optimization

### 1. Image Optimization

```tsx
// components/ui/optimized-image.tsx
import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  priority?: boolean;
  sizes?: string;
  placeholder?: 'blur' | 'empty';
}

export function OptimizedImage({
  src,
  alt,
  className,
  fill = false,
  priority = false,
  sizes,
  placeholder = 'empty',
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {!hasError ? (
        <Image
          src={src}
          alt={alt}
          fill={fill}
          priority={priority}
          sizes={sizes}
          placeholder={placeholder}
          className={cn(
            'object-cover transition-opacity duration-300',
            isLoading ? 'opacity-0' : 'opacity-100'
          )}
          onLoadingComplete={() => setIsLoading(false)}
          onError={() => {
            setHasError(true);
            setIsLoading(false);
          }}
        />
      ) : (
        <div className="flex items-center justify-center bg-gray-200 h-full">
          <span className="text-gray-500 text-sm">Image unavailable</span>
        </div>
      )}
    </div>
  );
}
```

### 2. Code Splitting and Lazy Loading

```tsx
// app/admin/layout.tsx
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { AdminSidebar } from '@/components/admin/sidebar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Lazy load admin components
const AdminHeader = dynamic(() => import('@/components/admin/header'), {
  loading: () => <div className="h-16 bg-gray-100 animate-pulse" />,
});

const ComplianceMonitor = dynamic(
  () => import('@/components/admin/compliance-monitor'),
  {
    loading: () => <LoadingSpinner />,
    ssr: false, // Only load on client side
  }
);

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-auto p-6">
          <Suspense fallback={<LoadingSpinner />}>
            <ComplianceMonitor />
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
```

## Testing Architecture

### 1. Component Testing with Testing Library

```tsx
// __tests__/components/donation-form.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DonationForm } from '@/components/donation/donation-form';
import { mockFundraiser, mockOrganization } from '@/lib/test-utils';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

function renderWithProviders(component: React.ReactNode) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
}

describe('DonationForm', () => {
  it('renders donation form with suggested amounts', () => {
    renderWithProviders(
      <DonationForm
        fundraiser={mockFundraiser}
        organization={mockOrganization}
      />
    );

    expect(screen.getByText('$25')).toBeInTheDocument();
    expect(screen.getByText('$50')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    renderWithProviders(
      <DonationForm
        fundraiser={mockFundraiser}
        organization={mockOrganization}
      />
    );

    fireEvent.click(screen.getByText('Donate $0'));

    await waitFor(() => {
      expect(screen.getByText('Amount is required')).toBeInTheDocument();
      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });
  });

  it('shows compliance warnings for large donations', async () => {
    renderWithProviders(
      <DonationForm
        fundraiser={mockFundraiser}
        organization={mockOrganization}
        initialAmount="2000"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/employer information required/i)).toBeInTheDocument();
    });
  });
});
```

### 2. E2E Testing with Playwright

```typescript
// e2e/donation-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Donation Flow', () => {
  test('complete donation process', async ({ page }) => {
    await page.goto('/donate/save-democracy-2024');

    // Select donation amount
    await page.click('[data-testid="amount-100"]');

    // Fill donor information
    await page.fill('[data-testid="first-name"]', 'John');
    await page.fill('[data-testid="last-name"]', 'Doe');
    await page.fill('[data-testid="email"]', 'john.doe@example.com');
    await page.fill('[data-testid="address"]', '123 Main St');
    await page.fill('[data-testid="city"]', 'Anytown');
    await page.selectOption('[data-testid="state"]', 'CA');
    await page.fill('[data-testid="zip"]', '90210');

    // Fill compliance information
    await page.fill('[data-testid="employer"]', 'Tech Corp');
    await page.fill('[data-testid="occupation"]', 'Software Engineer');

    // Add payment method (using test card)
    await page.fill('[data-testid="card-number"]', '4242424242424242');
    await page.fill('[data-testid="card-expiry"]', '12/25');
    await page.fill('[data-testid="card-cvc"]', '123');

    // Submit donation
    await page.click('[data-testid="donate-button"]');

    // Verify success
    await expect(page).toHaveURL(/\/donate\/success/);
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });

  test('handles contribution limit validation', async ({ page }) => {
    await page.goto('/donate/save-democracy-2024');

    // Attempt to donate over limit
    await page.fill('[data-testid="custom-amount"]', '5000');
    await page.fill('[data-testid="email"]', 'existing-donor@example.com');

    // Should show warning
    await expect(
      page.locator('[data-testid="contribution-limit-warning"]')
    ).toBeVisible();
  });
});
```

## Accessibility Implementation

### 1. ARIA Labels and Screen Reader Support

```tsx
// components/ui/form-field.tsx
import { forwardRef } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

const FormField = forwardRef<HTMLDivElement, FormFieldProps>(
  ({ label, error, required, description, children, className }, ref) => {
    const id = `field-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = error ? `${id}-error` : undefined;
    const descriptionId = description ? `${id}-description` : undefined;

    return (
      <div ref={ref} className={cn('space-y-2', className)}>
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>

        {description && (
          <p id={descriptionId} className="text-sm text-gray-600">
            {description}
          </p>
        )}

        <div className="relative">
          {React.cloneElement(children as React.ReactElement, {
            id,
            'aria-invalid': error ? 'true' : 'false',
            'aria-describedby': [descriptionId, errorId]
              .filter(Boolean)
              .join(' ') || undefined,
          })}
        </div>

        {error && (
          <p
            id={errorId}
            className="text-sm text-red-600"
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';

export { FormField };
```

### 2. Keyboard Navigation Support

```tsx
// components/ui/modal.tsx
'use client';

import { useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { trapFocus, restoreFocus } from '@/lib/a11y-utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Focus first focusable element in modal
      const firstFocusable = modalRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;

      firstFocusable?.focus();
    } else {
      // Restore focus to previous element
      previousActiveElement.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        ref={modalRef}
        className="sm:max-w-md"
        aria-labelledby="modal-title"
        onOpenAutoFocus={(e) => e.preventDefault()} // We handle focus manually
      >
        <div className="space-y-4">
          <h2 id="modal-title" className="text-lg font-semibold">
            {title}
          </h2>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

## Deployment Configuration

### 1. Next.js Configuration

```typescript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['storage.googleapis.com', 'images.unsplash.com'],
    formats: ['image/webp', 'image/avif'],
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/proxy/:path*',
        destination: `${process.env.API_URL}/:path*`,
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
```

### 2. Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "Research FluidPay API documentation and capabilities", "status": "completed", "activeForm": "Researching FluidPay API documentation and capabilities"}, {"content": "Create system architecture documentation", "status": "completed", "activeForm": "Creating system architecture documentation"}, {"content": "Design database schema for political donations platform", "status": "completed", "activeForm": "Designing database schema for political donations platform"}, {"content": "Document compliance requirements for political donations", "status": "completed", "activeForm": "Documenting compliance requirements for political donations"}, {"content": "Create API integration framework documentation", "status": "completed", "activeForm": "Creating API integration framework documentation"}, {"content": "Document GCP deployment architecture", "status": "completed", "activeForm": "Documenting GCP deployment architecture"}, {"content": "Create React/NextJS frontend architecture guide", "status": "completed", "activeForm": "Creating React/NextJS frontend architecture guide"}]