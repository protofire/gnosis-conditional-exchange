import { BigNumber, formatUnits } from 'ethers/utils'

/**
 * Formats BigNumber value to string (used mostly for displaying)
 * @param value - BigNumber to be formatted
 * @param decimals - Decimals BigNumber has (example ether=18,cDai=8)
 * @param precision - Decimal places after 0. that the value returned will have (example 2=0.01,3=0.001)
 * @param strict - If strict is set to true string returned will not be modified by formatNumber function which returns '<0.01' if value is small
 */
export const bigNumberToString = (value: BigNumber, decimals: number, precision = 2, strict = false): string => {
  if (strict) return bigNumberToNumber(value, decimals).toFixed(precision)
  return formatNumber(formatUnits(value, decimals), precision)
}
/**
 * Formats BigNumber value to number (used mostly for logical operations)
 * @param value - BigNumber to be formatted
 * @param decimals - Decimals BigNumber has (example ether=18,cDai=8,....)
 */
export const bigNumberToNumber = (value: BigNumber, decimals: number): number => {
  return Number(formatUnits(value, decimals))
}
export const formatNumber = (number: string, decimals = 2): string => {
  const fixedInt = parseFloat(number.split(',').join('')).toFixed(decimals)
  const splitFixedInt = fixedInt.split('.')[0]
  const formattedSubstring = splitFixedInt.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
  if (number.length < 1) {
    return `0${decimals > 0 ? '.' + '0'.repeat(decimals) : ''}`
  }

  if (Number(number) < 0.01 && Number(number) > 0) {
    return '<0.01'
  }

  return `${formattedSubstring}${decimals > 0 ? '.' + fixedInt.split('.')[1] : ''}`
}
export const formatHistoryUser = (user: string) => {
  const firstStringPart = user ? user.substring(0, 5) + '...' : ''
  const lastPart = user ? user.substring(user.length - 3, user.length) : ''

  return firstStringPart + lastPart
}
export const formatToShortNumber = (number: number, decimals = 2): string => {
  const insider = number.toFixed(2)

  if (insider.length < 1) {
    return '0'
  }

  const units = ['', 'K', 'M', 'B', 'T']
  let unitIndex = 0
  let rNumber = parseFloat(insider.split(',').join(''))

  while (rNumber >= 1000 && unitIndex < 5) {
    unitIndex += 1
    rNumber = rNumber / 1000
  }

  return `${parseFloat(rNumber.toFixed(decimals))}${units[unitIndex]}`
}
export const numberToByte32 = (num: string | number, isScalar: boolean): string => {
  let hex: any
  if (isScalar) hex = num
  else hex = new BigNumber(num).toHexString()

  const frontZeros = '0'.repeat(66 - hex.length)

  return `0x${frontZeros}${hex.split('0x')[1]}`
}

/**
 * Given a string representing a floating point number,
 * return a floating point number with a fixed amount of decimal places.
 */
export const limitDecimalPlaces = (value: string, decimals: number) => {
  const limitedString: string =
    value.indexOf('.') >= 0
      ? value.substr(0, value.indexOf('.')) + value.substr(value.indexOf('.'), decimals + 1)
      : value
  return Number.parseFloat(limitedString)
}
