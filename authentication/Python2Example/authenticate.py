import time
import hashlib
import hmac
import base64
import urllib

partner_id = 'public'                      # ID provided by AB. 
partner_key = '2jfaWErgt2+o48gsk302kd'     # Key provided by AB.
expires = str(int(time.time() + 86400))    # Seconds since epoch. Example expires in 24 hours.
user_id = '383485'                         # Partner defined. May be an empty string.

message = expires + "\n" + user_id
digest = hmac.new(partner_key.encode(), message.encode(), digestmod=hashlib.sha256).digest()
signature = base64.b64encode(digest).decode()
encoded_sig = urllib.quote_plus(signature)
parms = 'partner.id=' + partner_id + \
        '&auth.signature=' + encoded_sig + \
        '&auth.expires=' + expires + \
        '&user.id=' + user_id
result = urllib.urlopen('https://api.abconnect.certicaconnect.com/rest/v4.1/standards?' + parms).read()
print result
