#!/bin/sh
set -eu

SERVER="http://keycloak:8080"
REALM="${KEYCLOAK_ADMIN_REALM:-synapse}"
KCADM="/opt/keycloak/bin/kcadm.sh"

echo "Waiting for Keycloak realm ${REALM}..."
until "$KCADM" config credentials \
  --server "$SERVER" \
  --realm master \
  --user "$KEYCLOAK_ADMIN_USERNAME" \
  --password "$KEYCLOAK_ADMIN_PASSWORD" >/dev/null 2>&1; do
  sleep 2
done

until "$KCADM" get "realms/${REALM}" >/dev/null 2>&1; do
  sleep 2
done

"$KCADM" update "realms/${REALM}" \
  -s loginTheme=synapse \
  -s internationalizationEnabled=true \
  -s defaultLocale=fr \
  -s 'supportedLocales=["fr"]'

ensure_role() {
  role_name="$1"
  role_description="$2"
  if ! "$KCADM" get "roles/${role_name}" -r "$REALM" >/dev/null 2>&1; then
    "$KCADM" create roles -r "$REALM" -s name="$role_name" -s description="$role_description"
  fi
}

ensure_role INTERN "Internal Synapse user"
ensure_role EXTERN "External Synapse user"

ensure_user_profile() {
  username="$1"
  first_name="$2"
  last_name="$3"
  user_id="$("$KCADM" get users -r "$REALM" -q username="$username" --fields id --format csv --noquotes | head -n 1 | tr -d '\r')"
  if [ -n "$user_id" ]; then
    "$KCADM" update "users/${user_id}" -r "$REALM" \
      -s firstName="$first_name" \
      -s lastName="$last_name" \
      -s emailVerified=true
  fi
}

ensure_user_profile admin Synapse Admin
ensure_user_profile user Synapse User

synapse_client_id="$("$KCADM" get clients -r "$REALM" -q clientId=synapse-client --fields id --format csv --noquotes | head -n 1 | tr -d '\r')"
if [ -n "$synapse_client_id" ]; then
  "$KCADM" update "clients/${synapse_client_id}" -r "$REALM" \
    -s 'redirectUris=["http://localhost:5173/","http://localhost:5173/*","http://127.0.0.1:5173/","http://127.0.0.1:5173/*"]' \
    -s 'webOrigins=["http://localhost:5173","http://127.0.0.1:5173"]'
fi

client_id="$("$KCADM" get clients -r "$REALM" -q clientId=gateway-admin --fields id --format csv --noquotes 2>/dev/null | head -n 1 | tr -d '\r')"
if [ -z "$client_id" ]; then
  "$KCADM" create clients -r "$REALM" \
    -s clientId=gateway-admin \
    -s name="Synapse backend administration" \
    -s enabled=true \
    -s publicClient=false \
    -s serviceAccountsEnabled=true \
    -s standardFlowEnabled=false \
    -s directAccessGrantsEnabled=false \
    -s clientAuthenticatorType=client-secret \
    -s secret="$KEYCLOAK_ADMIN_CLIENT_SECRET"
  client_id="$("$KCADM" get clients -r "$REALM" -q clientId=gateway-admin --fields id --format csv --noquotes | head -n 1 | tr -d '\r')"
else
  "$KCADM" update "clients/${client_id}" -r "$REALM" \
    -s enabled=true \
    -s publicClient=false \
    -s serviceAccountsEnabled=true \
    -s standardFlowEnabled=false \
    -s directAccessGrantsEnabled=false \
    -s clientAuthenticatorType=client-secret \
    -s secret="$KEYCLOAK_ADMIN_CLIENT_SECRET"
fi

for role_name in query-users view-users manage-users view-realm; do
  "$KCADM" add-roles -r "$REALM" \
    --uusername service-account-gateway-admin \
    --cclientid realm-management \
    --rolename "$role_name"
done

echo "Keycloak realm ${REALM} provisioned."
