import React from 'react'
import { Helmet } from 'react-helmet'

import { DOCUMENT_TITLE } from '../../../../common/constants'
import { useConnectedWeb3Context } from '../../../../contexts/connectedWeb3'
import { isScalarMarket } from '../../../../util/tools'
import { MarketMakerData } from '../../../../util/types'
import { SectionTitle, TextAlign } from '../../../common/text/section_title'

import { ClosedMarketDetails } from './market_status/closed'
import { OpenMarketDetails } from './market_status/open'

interface Props {
  account: Maybe<string>
  marketMakerData: MarketMakerData
  fetchGraphMarketMakerData: () => Promise<void>
}

const MarketView: React.FC<Props> = (props: Props) => {
  const { marketMakerData } = props

  const { isQuestionFinalized, oracle, question } = marketMakerData

  const context = useConnectedWeb3Context()

  const renderView = () => {
    const isScalar = isScalarMarket(oracle || '', context.networkId || 0)

    if (isQuestionFinalized) {
      return <ClosedMarketDetails isScalar={isScalar} {...props} />
    } else {
      return <OpenMarketDetails isScalar={isScalar} {...props} />
    }
  }

  return (
    <>
      <Helmet>
        <title>{`${question.title} - ${DOCUMENT_TITLE}`}</title>
      </Helmet>
      <SectionTitle goBack={true} textAlign={TextAlign.left} title={question.title} />
      {renderView()}
    </>
  )
}

export { MarketView }
