ssh-keygen -t rsa -b 2048 -m PEM -f keys/private.key
openssl rsa -in keys/private.key -pubout -outform PEM -out keys/public.key
rm keys/private.key.pub
