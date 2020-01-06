import { providers } from 'ethers'
import React, { useState, useEffect } from 'react'
import { useWeb3Context } from 'web3-react'
import connectors from '../util/connectors'

export interface ConnectedWeb3Context {
  account: Maybe<string>
  library: providers.Web3Provider
  networkId: number
  rawWeb3Context: any
}

const ConnectedWeb3Context = React.createContext<Maybe<ConnectedWeb3Context>>(null)

/**
 * This hook can only be used by components under the `ConnectedWeb3` component. Otherwise it will throw.
 */
export const useConnectedWeb3Context = () => {
  const context = React.useContext(ConnectedWeb3Context)

  if (!context) {
    throw new Error('Component rendered outside the provider tree')
  }

  return context
}

/**
 * Use this hook to connect the wallet automatically
 */
export const useConnectWeb3 = () => {
  const context = useWeb3Context()

  useEffect(() => {
    const connector = localStorage.getItem('CONNECTOR')
    if (connector && (connector as keyof typeof connectors)) {
      context.setConnector(connector)
    }
  }, [context])
}

interface Props {
  children: React.ReactNode
  infura?: boolean
}

/**
 * Component used to render components that depend on Web3 being available. These components can then
 * `useConnectedWeb3Context` safely to get web3 stuff without having to null check it.
 */
export const ConnectedWeb3: React.FC<Props> = props => {
  const [networkId, setNetworkId] = useState<number | null>(null)
  const context = useWeb3Context()

  useEffect(() => {
    let isSubscribed = true

    const checkIfReady = async () => {
      const network = await context.library.ready
      if (isSubscribed) setNetworkId(network.chainId)
    }

    if (props.infura) {
      context.setConnector('Infura')
    }

    if (context.library) {
      checkIfReady()
    }

    return () => {
      isSubscribed = false
    }
  }, [context, props.infura])

  if (!networkId) {
    return null
  }

  const value = {
    account: context.account || null,
    library: context.library,
    networkId,
    rawWeb3Context: context,
  }

  return (
    <ConnectedWeb3Context.Provider value={value}>{props.children}</ConnectedWeb3Context.Provider>
  )
}
