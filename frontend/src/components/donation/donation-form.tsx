'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AmountSelector } from './amount-selector'
import { donationSchema, type DonationFormData } from '@/lib/validations'
import { apiClient, getErrorMessage } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import type { Fundraiser, Organization } from '@/types/api'

interface DonationFormProps {
  fundraiser: Fundraiser
  organization: Organization
  initialAmount?: string
  initialRecurring?: boolean
}

export function DonationForm({
  fundraiser,
  organization,
  initialAmount,
  initialRecurring
}: DonationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<DonationFormData>({
    resolver: zodResolver(donationSchema),
    defaultValues: {
      amount: initialAmount ? parseFloat(initialAmount) : undefined,
      recurring: initialRecurring || false,
      frequency: 'monthly',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      employer: '',
      occupation: '',
      paymentMethod: {
        type: 'card',
        cardNumber: '',
        expiryMonth: '',
        expiryYear: '',
        cvc: ''
      }
    },
  })

  const watchedAmount = form.watch('amount')
  const watchedRecurring = form.watch('recurring')

  const onSubmit = async (data: DonationFormData) => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const donation = await apiClient.createDonation({
        amount: data.amount,
        recurring: data.recurring,
        frequency: data.frequency,
        fundraiserId: fundraiser.id,
        organizationId: organization.id,
        donorInfo: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          address: data.address,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
          employer: data.employer,
          occupation: data.occupation,
        },
        paymentMethod: data.paymentMethod
      })

      // Redirect to success page
      window.location.href = `/donate/success?id=${donation.id}`
    } catch (error) {
      setSubmitError(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Donate to {fundraiser.title}</CardTitle>
        <CardDescription>
          Support {organization.name} with your contribution
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Amount Selection */}
          <div className="space-y-3">
            <Label className="text-lg font-semibold">Choose Amount</Label>
            <AmountSelector
              value={watchedAmount}
              onChange={(amount) => form.setValue('amount', amount)}
              suggestedAmounts={fundraiser.suggestedAmounts}
            />
            {form.formState.errors.amount && (
              <p className="text-sm text-red-600">{form.formState.errors.amount.message}</p>
            )}
          </div>

          {/* Recurring Options */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="recurring"
                {...form.register('recurring')}
                className="rounded"
              />
              <Label htmlFor="recurring">Make this a recurring donation</Label>
            </div>
            {watchedRecurring && (
              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency</Label>
                <select
                  id="frequency"
                  {...form.register('frequency')}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            )}
          </div>

          {/* Donor Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Your Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  {...form.register('firstName')}
                  error={!!form.formState.errors.firstName}
                />
                {form.formState.errors.firstName && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.firstName.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  {...form.register('lastName')}
                  error={!!form.formState.errors.lastName}
                />
                {form.formState.errors.lastName && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                {...form.register('email')}
                error={!!form.formState.errors.email}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-red-600 mt-1">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                {...form.register('phone')}
                error={!!form.formState.errors.phone}
              />
            </div>

            <div>
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                {...form.register('address')}
                error={!!form.formState.errors.address}
              />
              {form.formState.errors.address && (
                <p className="text-sm text-red-600 mt-1">{form.formState.errors.address.message}</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  {...form.register('city')}
                  error={!!form.formState.errors.city}
                />
                {form.formState.errors.city && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.city.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="state">State *</Label>
                <Input
                  id="state"
                  {...form.register('state')}
                  placeholder="CA"
                  maxLength={2}
                  error={!!form.formState.errors.state}
                />
                {form.formState.errors.state && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.state.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="zipCode">ZIP Code *</Label>
                <Input
                  id="zipCode"
                  {...form.register('zipCode')}
                  error={!!form.formState.errors.zipCode}
                />
                {form.formState.errors.zipCode && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.zipCode.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Compliance Information */}
          {(watchedAmount >= 200) && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Employment Information</h3>
              <p className="text-sm text-gray-600">
                Federal law requires us to collect employment information for contributions of $200 or more.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="employer">Employer</Label>
                  <Input
                    id="employer"
                    {...form.register('employer')}
                    error={!!form.formState.errors.employer}
                  />
                </div>
                <div>
                  <Label htmlFor="occupation">Occupation</Label>
                  <Input
                    id="occupation"
                    {...form.register('occupation')}
                    error={!!form.formState.errors.occupation}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Payment Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Payment Information</h3>
            <div>
              <Label htmlFor="cardNumber">Card Number *</Label>
              <Input
                id="cardNumber"
                {...form.register('paymentMethod.cardNumber')}
                placeholder="1234 5678 9012 3456"
                error={!!form.formState.errors.paymentMethod?.cardNumber}
              />
              {form.formState.errors.paymentMethod?.cardNumber && (
                <p className="text-sm text-red-600 mt-1">{form.formState.errors.paymentMethod.cardNumber.message}</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="expiryMonth">Month *</Label>
                <Input
                  id="expiryMonth"
                  {...form.register('paymentMethod.expiryMonth')}
                  placeholder="12"
                  maxLength={2}
                  error={!!form.formState.errors.paymentMethod?.expiryMonth}
                />
              </div>
              <div>
                <Label htmlFor="expiryYear">Year *</Label>
                <Input
                  id="expiryYear"
                  {...form.register('paymentMethod.expiryYear')}
                  placeholder="25"
                  maxLength={2}
                  error={!!form.formState.errors.paymentMethod?.expiryYear}
                />
              </div>
              <div>
                <Label htmlFor="cvc">CVC *</Label>
                <Input
                  id="cvc"
                  {...form.register('paymentMethod.cvc')}
                  placeholder="123"
                  maxLength={4}
                  error={!!form.formState.errors.paymentMethod?.cvc}
                />
              </div>
            </div>
          </div>

          {submitError && (
            <Alert variant="destructive">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            variant="donate"
            disabled={isSubmitting || !watchedAmount || watchedAmount <= 0}
            className="w-full"
          >
            {isSubmitting ? 'Processing...' : `Donate ${formatCurrency(watchedAmount || 0)}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}