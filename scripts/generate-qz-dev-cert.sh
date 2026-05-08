#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${1:-.local/qz}"
FORCE="${2:-}"

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required to generate QZ Tray certificates." >&2
  exit 1
fi

if [ -e "${OUT_DIR}" ] && [ "${FORCE}" != "--force" ]; then
  echo "Refusing to overwrite existing ${OUT_DIR}." >&2
  echo "Run: npm run qz:cert:dev -- ${OUT_DIR} --force" >&2
  exit 1
fi

rm -rf "${OUT_DIR}"
mkdir -p "${OUT_DIR}"
chmod 700 "${OUT_DIR}"

ROOT_KEY="${OUT_DIR}/vcms-root-ca-key.pem"
ROOT_CERT="${OUT_DIR}/vcms-root-ca.crt"
LEAF_KEY="${OUT_DIR}/private-key.pem"
LEAF_CSR="${OUT_DIR}/vcms-qz.csr"
LEAF_CERT="${OUT_DIR}/digital-certificate.txt"
PUBLIC_KEY="${OUT_DIR}/public-key.txt"
ROOT_CONFIG="${OUT_DIR}/root-ca.cnf"
LEAF_EXT="${OUT_DIR}/leaf.ext"

cat > "${ROOT_CONFIG}" <<'EOF'
[req]
distinguished_name = dn
x509_extensions = v3_ca
prompt = no

[dn]
C = IN
ST = Delhi
L = Delhi
O = VCMS
OU = QZ Tray
CN = VCMS QZ Tray Local Root CA

[v3_ca]
basicConstraints = critical, CA:true
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
EOF

cat > "${LEAF_EXT}" <<'EOF'
basicConstraints = critical, CA:false
keyUsage = critical, digitalSignature
extendedKeyUsage = codeSigning
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
EOF

openssl genrsa -out "${ROOT_KEY}" 2048
openssl req -x509 -new -nodes -key "${ROOT_KEY}" -sha512 -days 3650 \
  -out "${ROOT_CERT}" -config "${ROOT_CONFIG}"

openssl genrsa -out "${LEAF_KEY}" 2048
openssl req -new -key "${LEAF_KEY}" -out "${LEAF_CSR}" \
  -subj "/C=IN/ST=Delhi/L=Delhi/O=VCMS/OU=QZ Tray/CN=VCMS QZ Browser Signing"
openssl x509 -req -in "${LEAF_CSR}" -CA "${ROOT_CERT}" -CAkey "${ROOT_KEY}" -CAcreateserial \
  -out "${LEAF_CERT}" -days 825 -sha512 -extfile "${LEAF_EXT}"
openssl rsa -in "${LEAF_KEY}" -pubout -out "${PUBLIC_KEY}" >/dev/null 2>&1

chmod 600 "${ROOT_KEY}" "${LEAF_KEY}"
chmod 644 "${ROOT_CERT}" "${LEAF_CERT}" "${PUBLIC_KEY}"
rm -f "${LEAF_CSR}" "${ROOT_CONFIG}" "${LEAF_EXT}" "${OUT_DIR}/vcms-root-ca.srl"

case "${OUT_DIR}" in
  /*) ABS_OUT_DIR="${OUT_DIR}" ;;
  *) ABS_OUT_DIR="${PWD}/${OUT_DIR}" ;;
esac

cat <<EOF
Generated QZ Tray development certificate material in ${OUT_DIR}

Save these through Admin -> QZ Integration:
Digital Certificate: ${ABS_OUT_DIR}/digital-certificate.txt
Private Key: ${ABS_OUT_DIR}/private-key.pem

Use this root CA for the VCMS QZ Tray fork authcert.override/provisioning:
${ABS_OUT_DIR}/vcms-root-ca.crt

Keep private files out of git:
${ABS_OUT_DIR}/vcms-root-ca-key.pem
${ABS_OUT_DIR}/private-key.pem
EOF
