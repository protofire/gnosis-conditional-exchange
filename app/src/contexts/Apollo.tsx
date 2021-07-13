import { ApolloProvider } from '@apollo/react-hooks'
import React from 'react'

import { getApolloClient } from '../apolloClientConfig'

import { useConnectedWeb3Context } from './connectedWeb3'

export const ApolloProviderWrapper: React.FC = ({ children }) => {
  const { networkId } = useConnectedWeb3Context()
  const client = React.useMemo(() => getApolloClient(networkId), [networkId])

  return <ApolloProvider client={client}>{children}</ApolloProvider>
}
