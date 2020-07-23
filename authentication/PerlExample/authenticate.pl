#!/usr/bin/perl
use strict;

use Digest::SHA qw(hmac_sha256_base64);
use LWP::UserAgent;

my $partner_id = 'public';                  # ID provided by AB.
my $partner_key = '2jfaWErgt2+o48gsk302kd'; # Key provided by AB.
my $expires = time() + 86400;               # Seconds since epoch. Example is 24 hours.
my $user_id = 383485;                       # Partner defined. May be an empty string.

my $message = "$expires\n$user_id";
my $signature = hmac_sha256_base64($message, $partner_key);

my $uri = URI->new();
$uri->scheme('https');
$uri->host('api.abconnect.certicaconnect.com');
$uri->port(443);
$uri->path('rest/v4.1/standards');
$uri->query_form(
  'partner.id'     => $partner_id,
  'auth.signature' => $signature,
  'auth.expires'   => $expires,
  'user.id'        => $user_id
);

my $req = HTTP::Request->new(GET => $uri);
my $ua = LWP::UserAgent->new();
my $response = $ua->request($req);

print 'response code = '.$response->{_rc}."\n";
if ($response->{_rc} && ($response->{_rc} == 200)) {
  if ($response->{_content}) {
    print $response->{_content};
  }
}