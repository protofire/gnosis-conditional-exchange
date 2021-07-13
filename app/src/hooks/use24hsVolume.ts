import { useQuery } from '@apollo/react-hooks'
import { BigNumber } from 'ethers/utils'
import gql from 'graphql-tag'
import { useEffect, useState } from 'react'

import { useConnectedWeb3Context } from '../contexts/connectedWeb3'
import { getLogger } from '../util/logger'

const logger = getLogger('Market::use24hsVolume')

const GET_COLLATERAL_VOLUME_NOW = gql`
  query Current($id: String) {
    fixedProductMarketMakers(where: { id: $id }) {
      collateralVolume
    }
  }
`

const buildQuery24hsEarlier = (hash: Maybe<string>) => {
  return gql`
  query AfterHash($id: String) {
    fixedProductMarketMakers(where: { id: $id }, block: { hash: "${hash}" }) {
      collateralVolume
    }
  }
`
}

export const use24hsVolume = (marketMakerAddress: string): Maybe<BigNumber> => {
  const [hash, setHash] = useState<Maybe<string>>(null)
  const [lastDayVolume, setLastDayVolume] = useState<Maybe<BigNumber>>(null)

  const { library: provider } = useConnectedWeb3Context()

  const { data: volumeNow, error: errorVolumeNow } = useQuery(GET_COLLATERAL_VOLUME_NOW, {
    skip: !!lastDayVolume,
    variables: { id: marketMakerAddress.toLowerCase() },
  })

  const { data: volumeBefore, error: errorVolumeBefore } = useQuery(buildQuery24hsEarlier(hash && hash.toLowerCase()), {
    skip: !!lastDayVolume || !hash,
    variables: { id: marketMakerAddress.toLowerCase() },
  })

  if (errorVolumeBefore || errorVolumeNow) {
    setLastDayVolume(null)
    errorVolumeBefore && logger.log(errorVolumeBefore)
    errorVolumeNow && logger.log(errorVolumeNow)
  } else if (volumeNow && volumeBefore) {
    const marketNow = volumeNow.fixedProductMarketMakers[0]
    const marketBefore = volumeBefore.fixedProductMarketMakers[0]
    const now = new BigNumber(marketNow ? marketNow.collateralVolume : 0)
    const before = new BigNumber(marketBefore ? marketBefore.collateralVolume : 0)

    setLastDayVolume(now.sub(before))
  }

  useEffect(() => {
    const setEarlierHash = async () => {
      const BLOCKS_PER_SECOND = 15
      const OFFSET = Math.round((60 * 60 * 24) / BLOCKS_PER_SECOND)
      const lastBlock = await provider.getBlockNumber()
      const { hash } = await provider.getBlock(lastBlock - OFFSET)
      setHash(hash)
    }

    setEarlierHash()
  }, [provider])

  return lastDayVolume
}
