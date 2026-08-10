import Keycloak from 'keycloak-js'

const keycloak = new Keycloak({
  url: 'http://localhost:8080',
  realm: 'synapse',
  clientId: 'synapse-client'
})

export default keycloak