/* eslint-env jest */
import Big from 'big.js'
import { BigNumber, parseUnits } from 'ethers/utils'

import { getContractAddress, getNativeAsset } from '../networks'
import { Token } from '../types'

import {
  bigMax,
  bigMin,
  bigNumberToNumber,
  bigNumberToString,
  calcXValue,
  clampBigNumber,
  formatHistoryDate,
  formatHistoryUser,
  formatNumber,
  formatTimestampToDate,
  formatToShortNumber,
  getIndexSets,
  getInitialCollateral,
  getNetworkFromChain,
  getScalarTitle,
  getUnit,
  isDust,
  isObjectEqual,
  isScalarMarket,
  limitDecimalPlaces,
  reverseArray,
  roundNumberStringToSignificantDigits,
  signaturesFormatted,
  strip0x,
  truncateStringInTheMiddle as truncate,
} from './index'

describe('tools', () => {
  describe('strip0x', () => {
    const testCases: any = [
      ['0x8b4dec1a0afb6eb5e98c7103aa94b34b2fc0a1ee', '8b4dec1a0afb6eb5e98c7103aa94b34b2fc0a1ee'],
      ['0xb9c764114c5619a95d7f232594e3b8dddf95b9cf', 'b9c764114c5619a95d7f232594e3b8dddf95b9cf'],
    ]
    for (const [address, testCase] of testCases) {
      it('should strip 0x', () => {
        const stripped = strip0x(address)
        expect(stripped).toBe(testCase)
      })
    }
  })
  describe('getNetworkFromChain', () => {
    const testCases: any = [
      ['0x4', 4],
      ['4', 4],
      ['0x1', 1],
      ['0x3', -1],
    ]
    for (const [network, result] of testCases) {
      it('should give network or -1 if invalid', () => {
        const getNetwork = getNetworkFromChain(network)
        expect(result).toBe(getNetwork)
      })
    }
  })

  describe('xDaiSignaturesFormatted', () => {
    const result =
      '0x031b1b1caac5732b8905bbc30f4c4ca680d0287b97ff8576cf40c68ce6af4686a0426d91cf4b1dbb0edb29d279bc6737216f148907e3265ab8473aa7a86e9bf4ecbb50e5d5d74999642e8d0216b5283546e840cc893e0e29e291cc26ae1d612f83ec88235e6364e2c9df0f911ab73d8176e803bb067ca3e35323d2429ec00c53d3fc5e0e58f9655bb999ac578db1da0ceda42f415ef085768f9a98803f4eaeee3d2681967a505e1aec565b15dcf14a248ad0edc61bfd9bb7b763a4a310cbb539d04c342f'
    const signatures = [
      '0xaac5732b8905bbc30f4c4ca680d0287b97ff8576cf40c68ce6af4686a0426d915e6364e2c9df0f911ab73d8176e803bb067ca3e35323d2429ec00c53d3fc5e0e1b',
      '0xcf4b1dbb0edb29d279bc6737216f148907e3265ab8473aa7a86e9bf4ecbb50e558f9655bb999ac578db1da0ceda42f415ef085768f9a98803f4eaeee3d2681961b',
      '0xd5d74999642e8d0216b5283546e840cc893e0e29e291cc26ae1d612f83ec88237a505e1aec565b15dcf14a248ad0edc61bfd9bb7b763a4a310cbb539d04c342f1c',
    ]
    it('should return signatures formatted', () => {
      const formmated = signaturesFormatted(signatures)
      expect(result).toMatch(formmated)
    })
  })

  describe('getIndexSets', () => {
    const testCases: any = [
      [3, [1, 2, 4]],
      [4, [1, 2, 4, 8]],
      [5, [1, 2, 4, 8, 16]],
    ]

    for (const [outcomesCount, expected] of testCases) {
      it(`should get the correct indexSet`, () => {
        const result = getIndexSets(outcomesCount)

        expect(result).toStrictEqual(expected)
      })
    }
  })

  describe('truncateStringInTheMiddle', () => {
    it('should not change string with truncate positions great or equal than string length', () => {
      expect(truncate('foobar', 4, 2)).toBe('foobar')
      expect(truncate('foobar', 6, 6)).toBe('foobar')
    })

    it('should truncate string with three dots in the middle', () => {
      expect(truncate('foobarbaz', 3, 2)).toBe('foo...az')
      expect(truncate('foobarbaz', 1, 1)).toBe('f...z')
    })
  })

  describe('limitDecimalPlaces', () => {
    const testCases: [[string, number], number][] = [
      [['2.7598', 2], 2.75],
      [['3', 3], 3],
      [['4958.532334211132', 5], 4958.53233],
      [['0.001', 2], 0.0],
      [['0.7688', 3], 0.768],
      [['19.22', 2], 19.22],
      [['12.1', 2], 12.1],
    ]
    for (const [[value, decimals], result] of testCases) {
      it('should return the correct value', () => {
        const limitedValue = limitDecimalPlaces(value, decimals)

        expect(limitedValue).toStrictEqual(result)
      })
    }
  })
  describe('bigNumberToString', () => {
    const testCases: [[string, number, number], string][] = [
      [['14300', 18, 3], '14,300.000'],
      [['0.001', 18, 2], '<0.01'],
      [['333', 18, 1], '333.0'],
    ]

    for (const [values, expected] of testCases) {
      it(`should return string representation of BigNumber`, () => {
        const constructBigNumber = parseUnits(values[0], values[1])
        const result = bigNumberToString(constructBigNumber, values[1], values[2])
        expect(result).toEqual(expected)
      })
    }
  })
  describe('bigNumberToNumber', () => {
    const testCases: [[string, number], number][] = [
      [['143', 18], 143],
      [['222', 8], 222],
      [['333', 18], 333],
    ]

    for (const [values, expected] of testCases) {
      it(`should return number representation of BigNumber`, () => {
        const constructBigNumber = parseUnits(values[0], values[1])
        const result = bigNumberToNumber(constructBigNumber, values[1])

        expect(result).toEqual(expected)
      })
    }
  })

  describe('formatHistoryDate', () => {
    const testCases: [number, string][] = [
      [1610546486000, '13.1 - 14:01'],
      [1610460714000, '12.1 - 14:11'],
      [1609374633000, '31.12 - 00:30'],
    ]
    for (const [timestamp, result] of testCases) {
      const unitResult = formatHistoryDate(timestamp)
      expect(unitResult).toMatch(result)
    }
  })

  describe('formatTimestampToDate', () => {
    const testCases: [[number, string], string][] = [
      [[1607993079, '1M'], 'Dec 15'],
      [[1608166400, '1D'], '00:53'],
      [[1608513696, '1h'], 'Dec 21'],
    ]
    for (const [[timestamp, value], result] of testCases) {
      const unitReuslt = formatTimestampToDate(timestamp, value)

      expect(result).toMatch(unitReuslt)
    }
  })

  describe('formatHistoryUser', () => {
    const testCases: [string, string][] = [
      ['0xceacf86c3d38cec12b3eb35633af089df90d28a4', '0xcea...8a4'],
      ['0xc390fcabd6cfaee6faa1fb3afac6c456d731c3f9', '0xc39...3f9'],
      ['0x4c35233ef1ead84c10684c0b685d2641717017cd', '0x4c3...7cd'],
    ]

    for (const [user, result] of testCases) {
      const unitResult = formatHistoryUser(user)

      expect(unitResult).toMatch(result)
    }
  })

  describe('formatNumber', () => {
    const testCases: [[string, number], string][] = [
      [['1234567.8910', 2], '1,234,567.89'],
      [['0', 8], '0.00000000'],
      [['4269.123123222334', 0], '4,269'],
    ]
    for (const [[number, decimals], result] of testCases) {
      it('should return the correct numerical string', () => {
        const formattedNumber = formatNumber(number, decimals)

        expect(formattedNumber).toStrictEqual(result)
      })
    }
  })

  describe('formatToShortNumber', () => {
    const testCases: [[number, number], string][] = [
      [[1234567.891, 2], '1.23M'],
      [[0, 8], '0'],
      [[4269.123123222334, 0], '4K'],
      [[20100, 2], '20.1K'],
    ]
    for (const [[number, decimals], result] of testCases) {
      it('should return the correct numerical string', () => {
        const formattedNumber = formatToShortNumber(number, decimals)

        expect(formattedNumber).toStrictEqual(result)
      })
    }
  })

  describe('isObjectEqual', () => {
    const testCases: [[any, any], boolean][] = [
      [['', ''], true],
      [['0', '0'], true],
      [[0, 0], true],
      [['0', 0], false],
      [[{}, {}], true],
      [
        [
          { a: 1, b: 'z' },
          { a: 1, b: 'z' },
        ],
        true,
      ],
      [
        [
          ['a', 'b', 3],
          ['a', 'b', 3],
        ],
        true,
      ],
      [
        [
          { a: 1, b: { c: 1, d: 1 } },
          { a: 1, b: { c: 1, d: 1 } },
        ],
        true,
      ],
      [
        [
          { a: 1, b: { c: ['2', '3'], d: 1 } },
          { a: 1, b: { c: ['2', '3'], d: 1 } },
        ],
        true,
      ],
    ]
    for (const [[obj1, obj2], result] of testCases) {
      it('should return if two params are the same', () => {
        const isSame = isObjectEqual(obj1, obj2)

        expect(isSame).toStrictEqual(result)
      })
    }
  })

  describe('clampBigNumber', () => {
    const testCases: [[BigNumber, BigNumber, BigNumber], BigNumber][] = [
      [[new BigNumber(0), new BigNumber(2), new BigNumber(7)], new BigNumber(2)],
      [[new BigNumber(1232), new BigNumber(0), new BigNumber(283)], new BigNumber(283)],
      [[new BigNumber(3), new BigNumber(1), new BigNumber(14)], new BigNumber(3)],
    ]
    for (const [[x, min, max], result] of testCases) {
      it('should return a clamped big number', () => {
        const clampedBigNumber = clampBigNumber(x, min, max)

        expect(clampedBigNumber).toStrictEqual(result)
      })
    }
  })

  describe('isDust', () => {
    const testCases: [[BigNumber, number], boolean][] = [
      [[new BigNumber(0), 6], true],
      [[new BigNumber(1), 18], true],
      [[new BigNumber(1000), 6], false],
      [[new BigNumber(1), 6], true],
      [[new BigNumber(100000000), 12], false],
    ]
    for (const [[amount, decimals], result] of testCases) {
      it('should correctly determine whether the amount is dust', () => {
        const isDustResult = isDust(amount, decimals)

        expect(isDustResult).toStrictEqual(result)
      })
    }
  })

  describe('isScalarMarket', () => {
    const testCases: [[string, number], boolean][] = [
      [[getContractAddress(1, 'realitioScalarAdapter').toLowerCase(), 1], true],
      [[getContractAddress(4, 'realitioScalarAdapter').toLowerCase(), 4], true],
      [[getContractAddress(4, 'realitio').toLowerCase(), 4], false],
      [[getContractAddress(1, 'realitio').toLowerCase(), 1], false],
      [['Incorrect address', 1], false],
    ]
    for (const [[oracle, networkId], result] of testCases) {
      const isScalarResult = isScalarMarket(oracle, networkId)

      expect(isScalarResult).toStrictEqual(result)
    }
  })

  describe('getUnit', () => {
    const testCases: [string, string][] = [
      ['What is the [unit] for ETH [USD]', 'USD'],
      ['What is the unit [CAT]', 'CAT'],
      ['[[unit] unit]][asdf] [ETH]', 'ETH'],
      ['What about weird casing [CaSInG]', 'CaSInG'],
    ]
    for (const [title, result] of testCases) {
      const unitResult = getUnit(title)

      expect(unitResult).toStrictEqual(result)
    }
  })

  describe('calcXValue', () => {
    const testCases: [[BigNumber, BigNumber, BigNumber], number][] = [
      [[parseUnits('5', 18), parseUnits('0', 18), parseUnits('10', 18)], 50],
      [[parseUnits('40', 18), parseUnits('5', 18), parseUnits('105', 18)], 35],
      [[parseUnits('2', 18), parseUnits('0', 18), parseUnits('10', 18)], 20],
      [[parseUnits('103', 18), parseUnits('0', 18), parseUnits('100', 18)], 100],
      [[parseUnits('-3', 18), parseUnits('0', 18), parseUnits('100', 18)], 0],
    ]
    for (const [[currentPrediction, lowerBound, upperBound], result] of testCases) {
      const xValue = calcXValue(currentPrediction, lowerBound, upperBound)

      expect(xValue).toStrictEqual(result)
    }
  })

  describe('bigMax', () => {
    const testCases: [Big[], Big][] = [
      [[new Big(0), new Big(1)], new Big(1)],
      [[new Big('12345'), new Big(123)], new Big(12345)],
      [[new Big(1829378123), new Big(-12323434)], new Big(1829378123)],
    ]
    for (const [array, result] of testCases) {
      const max = bigMax(array)

      expect(max).toStrictEqual(result)
    }
  })

  describe('bigMin', () => {
    const testCases: [Big[], Big][] = [
      [[new Big(0), new Big(1)], new Big(0)],
      [[new Big('12345'), new Big(123)], new Big('123')],
      [[new Big(1829378123), new Big(-12323434)], new Big(-12323434)],
    ]
    for (const [array, result] of testCases) {
      const min = bigMin(array)

      expect(min).toStrictEqual(result)
    }
  })

  describe('getInitialCollateral', () => {
    const testCases: [[number, Token], Token][] = [
      [[1, getNativeAsset(1)], getNativeAsset(1)],
      [[4, getNativeAsset(4)], getNativeAsset(4)],
      [[77, getNativeAsset(77)], getNativeAsset(77)],
      [[100, getNativeAsset(100)], getNativeAsset(100)],
    ]
    for (const [[sd, token], result] of testCases) {
      const initialCollateralValue = getInitialCollateral(sd, token)
      expect(result).toStrictEqual(initialCollateralValue)
    }
  })

  describe('roundNumberStringToSignificantDigits', () => {
    const testCases: [[string, number], string][] = [
      [['123.45', 4], '123.4'],
      [['0', 2], '0'],
    ]
    for (const [[value, sd], result] of testCases) {
      const significantDigitValue = roundNumberStringToSignificantDigits(value, sd)
      expect(result).toStrictEqual(significantDigitValue)
    }
  })

  describe('getScalarTitle', () => {
    const testCases: [[string], string][] = [
      [['Some random sclar market? [test]'], 'Some random sclar market?'],
      [['scalar for testing which will last an eternity [Violets]'], 'scalar for testing which will last an eternity'],
    ]
    for (const [[value], result] of testCases) {
      const modifiedTitle = getScalarTitle(value)
      expect(result).toStrictEqual(modifiedTitle)
    }
  })

  describe('reverseArray', () => {
    const testCases: [any[], any[]][] = [
      [
        [1, 2, 3],
        [3, 2, 1],
      ],
      [
        ['a', 2, 'hello'],
        ['hello', 2, 'a'],
      ],
    ]
    for (const [array, result] of testCases) {
      const reversedArray = reverseArray(array)
      expect(result).toStrictEqual(reversedArray)
    }
  })
})
