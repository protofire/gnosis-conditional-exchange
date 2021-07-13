import Box from '3box'
import ThreeBoxCommentsReact from '3box-comments-react'
import React, { useState } from 'react'
import styled from 'styled-components'

import { THREEBOX_ADMIN_ADDRESS, THREEBOX_SPACE_NAME } from '../../common/constants'
import { ConnectedWeb3Context, useConnectedWeb3Context } from '../../contexts/connectedWeb3'

const CommentsTitle = styled.h3`
  color: #000;
  font-size: 18px;
  font-weight: 500;
  line-height: 1.2;
  margin: 0 0 20px;
`

const ThreeBoxCustom = styled.div`
  margin: 30px 0;
  max-width: 100%;
  width: ${props => props.theme.mainContainer.maxWidth};

  .threebox-comments-react {
    overflow: visible !important;
  }

  .footer_text {
    flex-direction: column;
    justify-content: space-between;
    height: 48px;
  }

  .input_postLoading_text {
    .footer_text_image {
      display: none;
    }
  }

  .input_postLoading {
    left: calc(50% - 24px);
  }

  .showLoggedInAs {
    display: none;
  }
`

interface Props {
  threadName: string
}

export const ThreeBoxComments = (props: Props) => {
  const context: ConnectedWeb3Context = useConnectedWeb3Context()
  const { library } = context
  const { threadName } = props

  const [box, setBox] = useState<any>(null)
  // eslint-disable-next-line no-warning-comments
  // TODO: fix with useConnectedWeb3Wallet context
  const currentUserAddress = context.account || ''

  const handleLogin = async () => {
    const box = await Box.openBox(currentUserAddress, library._web3Provider, {})
    box.onSyncDone(() => setBox(box))
  }

  return (
    <ThreeBoxCustom className="threeBoxCustom">
      <CommentsTitle>Comments</CommentsTitle>
      <ThreeBoxCommentsReact
        adminEthAddr={THREEBOX_ADMIN_ADDRESS}
        box={box}
        currentUserAddr={currentUserAddress}
        loginFunction={handleLogin}
        showCommentCount={10}
        spaceName={THREEBOX_SPACE_NAME}
        threadName={threadName}
        useHovers={true}
      />
    </ThreeBoxCustom>
  )
}
