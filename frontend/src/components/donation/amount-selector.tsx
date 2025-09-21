'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface AmountSelectorProps {
  value?: number
  onChange: (amount: number) => void
  suggestedAmounts?: number[]
  maxAmount?: number
  className?: string
}

export function AmountSelector({
  value,
  onChange,
  suggestedAmounts = [25, 50, 100, 250, 500, 1000],
  maxAmount,
  className,
}: AmountSelectorProps) {
  const [customAmount, setCustomAmount] = useState('')
  const [isCustom, setIsCustom] = useState(false)

  const handleSuggestedAmount = (amount: number) => {
    setIsCustom(false)
    setCustomAmount('')
    onChange(amount)
  }

  const handleCustomAmount = (amount: string) => {
    const numAmount = parseFloat(amount)
    if (!isNaN(numAmount) && numAmount > 0) {
      setIsCustom(true)
      setCustomAmount(amount)
      onChange(numAmount)
    } else {
      setCustomAmount(amount)
      if (amount === '') {
        onChange(0)
      }
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-3 gap-3">
        {suggestedAmounts.map((amount) => (
          <Button
            key={amount}
            type="button"
            variant={value === amount && !isCustom ? "default" : "outline"}
            onClick={() => handleSuggestedAmount(amount)}
            disabled={maxAmount ? amount > maxAmount : false}
            className="text-center"
          >
            ${amount}
          </Button>
        ))}
      </div>

      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg font-medium">
          $
        </div>
        <Input
          type="number"
          placeholder="Other amount"
          value={customAmount}
          onChange={(e) => handleCustomAmount(e.target.value)}
          className="pl-8 text-lg"
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
  )
}