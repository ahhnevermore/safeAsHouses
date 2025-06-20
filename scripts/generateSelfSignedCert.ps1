# PowerShell script to generate a self-signed certificate for local development
# This will create server.key and server.crt in the parent directory

$cert = New-SelfSignedCertificate -DnsName "localhost" -CertStoreLocation "cert:\LocalMachine\My"
$pwd = ConvertTo-SecureString -String "password" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "..\localhost.pfx" -Password $pwd
Export-Certificate -Cert $cert -FilePath "..\server.crt"
