// Platform FAQ: rendered by app/faq/page.tsx (with its FAQPage schema) and written out in /llms-full.txt.
// Static on purpose: nothing here is edited by admins. Move to a table if that changes.
import {
  Crown, Shield, ClipboardList, Goal, Heart, Handshake, LifeBuoy, Sparkles, Info,
  type LucideIcon,
} from 'lucide-react';
import { bookingFeeCents, bookingFeeText } from './finance';

// Platform help (not club matters). Written as plain text in answers so the FAQ schema keeps it; linked when shown.
export const CONTACT_EMAIL = 'contact@itsfootball.club';

// The real number when the fee is configured, so AI answers and buyers quote it exactly
export const FEE_PHRASE = bookingFeeCents(10000) > 0 ? `a booking fee of ${bookingFeeText()}` : 'a small booking fee';

export type FaqSection = {
  id: string;
  audience: string;
  Icon: LucideIcon;
  color: string;
  pitch: string;
  cta?: { label: string; href: string };
  items: { q: string; a: string }[];
};

export const FAQ: FaqSection[] = [
  {
    id: 'about',
    audience: 'New to itsfootball.club',
    Icon: Info,
    color: 'var(--c-sky)',
    pitch: 'A free platform for grassroots and community football clubs in Australia, New Zealand, the Pacific and the UK.',
    cta: { label: 'See the clubs already on it', href: '/clubs' },
    items: [
      { q: 'What is itsfootball.club?', a: 'itsfootball.club is a free platform for grassroots and community football (soccer) clubs. It gives every club its own official website with a live match centre, fixtures and results, lineups, digital member passes with QR check-in, membership payments, a merch shop, tournaments and sponsor tools, all run by the club\'s volunteers from one admin dashboard.' },
      { q: 'How do I make a website for my football club?', a: 'Create your club at itsfootball.club/create-club with just an email address. Your club site goes live straight away at itsfootball.club/your-club, with fixtures, results, squad, news, sponsors and a contact form built in. Add your colours and logo under Branding and connect your own domain if you have one. No web designer, no coding, and it costs the club nothing.' },
      { q: 'Is there a free alternative to Pitchero, Spond or TeamApp?', a: `Yes. itsfootball.club covers the jobs clubs use those apps for, including a club website, player availability, lineups, live scores, member passes, collecting subs and selling merch, and every feature is free for the club. The only charge is ${FEE_PHRASE} on card payments, paid by the person paying, not by the club.` },
      { q: 'How do I show live scores for a grassroots or Sunday league match?', a: 'Open the Match Center in your club admin on a phone at the ground and record goals, cards and substitutions as they happen. Supporters follow the match page live, with the score, timeline and lineup, and there is nothing to install. Results, scorers and player stats then update the club\'s fixtures and leaderboard automatically.' },
      { q: 'Which countries can use itsfootball.club?', a: 'Clubs in any country can use it. It is built for grassroots football in Australia, New Zealand, the Pacific and the UK, and clubs take payments in their own currency, including AUD, NZD and GBP, straight into their own Stripe account. Online card payments need Stripe to be available in the club\'s country.' },
    ],
  },
  {
    id: 'pricing',
    audience: 'Is it really free?',
    Icon: Sparkles,
    color: 'var(--c-green)',
    pitch: 'Yes. Your club never pays a penny: no subscription, no premium tier, every feature included from day one.',
    cta: { label: 'Create your club free', href: '/create-club' },
    items: [
      { q: 'How much does itsfootball.club cost?', a: 'Nothing for your club. Your website, live match centre, member passes, lineups, finance, sponsor reports and everything else are included from the moment you sign up. No trial that runs out, no premium tier, no locked features, no invoice at the end of the season.' },
      { q: 'Why is it free?', a: 'Because grassroots clubs run on volunteers and tight budgets, and a monthly bill is exactly what keeps most of them stuck on group chats and spreadsheets. We believe the Sunday league side deserves the same matchday as the big clubs, so every club, however small, gets the full kit from day one.' },
      { q: 'So what\'s the catch?', a: `No catch, just one detail we'd rather tell you upfront. When someone pays your club by card through itsfootball.club, for a membership, a sponsorship or an order from the club shop, ${FEE_PHRASE} is added at checkout, like the one you see when you buy a match ticket online. It's shown clearly before anyone pays, and your club's price never changes: the money goes straight into your club's own Stripe account, less Stripe's standard card fee. We don't show ads to your players, we don't sell your data, and we never take a cut of what your club charges.` },
      { q: 'How does itsfootball.club make money?', a: 'Through that booking fee on card payments, and nothing else. It keeps us on the same side as your club: we only earn when your club is thriving online, collecting its subs, selling its merch and signing up sponsors, never by charging you to use the platform. And if your club refunds a card payment in full, the booking fee is refunded with it.' },
      { q: 'Do I need a card to create a club?', a: 'No. You only need an email address. Create your club in a few minutes and start using everything straight away, with no limits.' },
      { q: 'Are some features kept behind a paid plan?', a: 'No. Match Center, lineups, tournaments, the QR pass and scanner, finance, sponsors, the club shop, news, branding, custom domain and analytics are all available to every club from day one.' },
      { q: 'Do players or supporters pay anything?', a: `Following the live match centre, getting a member pass, checking your stats and replying to availability are always free. The only payments are the ones your club chooses to set, like a membership fee or merch from the club shop. If you pay by card, you'll see ${FEE_PHRASE} before you confirm; it's what keeps the whole platform free for your club.` },
    ],
  },
  {
    id: 'club-representatives',
    audience: 'Club representatives',
    Icon: Crown,
    color: 'var(--c-amber)',
    pitch: 'Give your club a professional home online in minutes, without paying a web designer.',
    cta: { label: 'Claim your club', href: '/create-club' },
    items: [
      { q: 'How do I put my club on itsfootball.club?', a: 'Go to Create Club (/create-club), sign up free with your email and a password, and fill in your club details. You become the club Owner with full admin access, and your club site is live right away. Need a hand getting set up? Email contact@itsfootball.club.' },
      { q: 'Can the club site use our own colours, logo and domain?', a: 'Yes. In your club admin, open Branding to set your colours, logo and a custom domain, and Hero Slider to choose the images on your club home page. It looks like your club, not like us.' },
      { q: 'How do supporters find our club?', a: 'Every active club is listed in the Clubs Directory (/clubs) and gets its own public page at itsfootball.club/your-club-name, ready to share on social media and in group chats.' },
      { q: 'Where do I find the clubs I manage or belong to?', a: 'Sign in and open My Clubs (/my-clubs). Every club you own, administer or are a member of is listed there.' },
    ],
  },
  {
    id: 'club-officials',
    audience: 'Club officials & admins',
    Icon: Shield,
    color: 'var(--c-blue)',
    pitch: 'Replace the spreadsheets, group chats and paper forms with one place to run the club.',
    cta: { label: 'Set up your admin area', href: '/create-club' },
    items: [
      { q: 'What can a club admin do?', a: 'Everything in one place: matchday tools (Match Center, availability, lineups, QR scanner), planning (matches, tournaments, events, seasons), people (squad, members, committee, ClubScore), money (finance, sponsors, club shop) and the club site (branding, news, analytics, enquiries).' },
      { q: 'How do I share the workload with other volunteers?', a: 'Open Squad in the admin area, edit the person and add the "Club Admin" role. They get the full admin area too, so the work doesn\'t all land on one person.' },
      { q: 'How do I track club money and sponsors?', a: 'Use Finance to log income and expenses, and Sponsors to review sponsor applications and manage your existing sponsors, so the treasurer always has an up-to-date picture.' },
      { q: 'Can we sell club merch?', a: 'Yes. Open Club Shop in the admin area and add your products with photos, sizes and a price. A Shop link appears on your club site as soon as something is on sale. Buyers pay by card, Apple Pay or Google Pay and collect their order from the club; every order is recorded in Finance, and you mark it handed out when it\'s picked up.' },
      { q: 'How do I post club news?', a: 'Open Content in the admin area. Published articles appear on your club home page for members and supporters, and each one gets its own page you can share.' },
      { q: 'Where do messages from the public contact form go?', a: 'To Inquiries in the admin area, so nothing gets lost in someone\'s personal inbox. Messages from signed-in members arrive in their member messages.' },
    ],
  },
  {
    id: 'managers-coaches',
    audience: 'Managers, coaches & committee',
    Icon: ClipboardList,
    color: 'var(--c-purple)',
    pitch: 'Know who can play before matchday, pick your squad and run the game live from your phone.',
    cta: { label: 'Set up your team', href: '/create-club' },
    items: [
      { q: 'How do I see which players are available?', a: 'Players mark themselves available or unavailable for each match. No more chasing replies in group chats: admins see every answer under Availability and pick the matchday squad under Lineup.' },
      { q: 'How do live match updates work?', a: 'During a match, an admin runs the Match Center to record the score, goals, cards and substitutions. Supporters following the match page see every update live, wherever they are.' },
      { q: 'How do tournaments work?', a: 'Create a tournament under Tournaments with a group stage, a knockout bracket (up to a round of 32), or both. Standings and the bracket update automatically as results come in, and each tournament gets its own public page.' },
      { q: 'How do check-ins work at matches and events?', a: 'Members show the QR code on their virtual pass and an admin scans it with the Scanner in the admin area. Anyone can check a pass on the club\'s Verify page.' },
      { q: 'Does the Manager, Coach or Executive Committee role give me admin access?', a: 'Not on its own. Those roles show your position in the club. For matchday tools such as lineups or the Match Center, ask your club Owner to add the "Club Admin" role to your squad profile.' },
    ],
  },
  {
    id: 'players',
    audience: 'Players',
    Icon: Goal,
    color: 'var(--c-green)',
    pitch: 'Your stats, your pass and your availability in one place. Free, and no password to remember.',
    cta: { label: 'Find your club', href: '/clubs' },
    items: [
      { q: 'How do I join my club?', a: 'Open your club\'s page, go to Member, and sign up or apply for a membership tier. The club committee approves applications, and your pass activates once you are approved. Joining the platform costs you nothing.' },
      { q: 'Where can I see my stats?', a: 'In the Stats tab of your member area. Your goals, assists and other stats count towards the club leaderboard and awards such as Player of the Tournament.' },
      { q: 'How do I tell the coach whether I can play?', a: 'Open your club\'s Availability page (itsfootball.club/your-club/availability) and answer for each upcoming match. It takes seconds.' },
      { q: 'How do I sign in?', a: 'On your club\'s Member page, enter your email and you\'ll get a one-time sign-in link. There is no password to remember.' },
      { q: 'My account isn\'t linked to my squad profile. What do I do?', a: 'Sign in with the same email your club has on file and your profile links automatically. If it still doesn\'t, ask a club admin to check the email on your squad record.' },
    ],
  },
  {
    id: 'supporters',
    audience: 'Members & supporters',
    Icon: Heart,
    color: 'var(--c-red)',
    pitch: 'Follow every match live, carry your member pass on your phone and stay close to your club.',
    cta: { label: 'Find your club', href: '/clubs' },
    items: [
      { q: 'How do I follow a live match?', a: 'Open your club\'s page and pick the match from the fixtures. The match page updates live with goals, cards and substitutions as the game is played.' },
      { q: 'What is the virtual member pass?', a: 'A QR code pass in the Pass tab of your member area. Show it on your phone to be checked in at matches and club events. Nothing to print, nothing to lose.' },
      { q: 'How do I pay my membership?', a: 'If your chosen tier has a fee, you pay it during sign-up by card, Apple Pay or Google Pay. Payment is handled securely by Stripe and goes straight to the club, with a small booking fee shown before you pay. For a refund, contact your club. If the payment page itself isn\'t working, email contact@itsfootball.club.' },
      { q: 'How do I buy club merch?', a: 'Open the Shop on your club\'s site (itsfootball.club/your-club/shop), pick your items and sizes, and pay by card, Apple Pay or Google Pay. You don\'t need to be a member. Orders are collection only: pick yours up from the club. For questions about an order or a refund, contact your club.' },
      { q: 'How do I contact my club?', a: 'Signed-in members can use the Messages tab in their member area. Anyone else can use the contact form on the club\'s page.' },
    ],
  },
  {
    id: 'sponsors',
    audience: 'Sponsors',
    Icon: Handshake,
    color: 'var(--c-sky)',
    pitch: 'Back a local club and put your brand in front of its players, members and supporters.',
    cta: { label: 'Find a club to back', href: '/clubs' },
    items: [
      { q: 'How do I sponsor a club?', a: 'Open the club\'s Sponsor page (itsfootball.club/club-name/sponsor) and send an application. It goes straight to the club\'s admins, who review it and get back to you.' },
      { q: 'Does it cost anything to apply?', a: 'No. Applying is free. Any sponsorship deal is agreed directly between you and the club.' },
      { q: 'Where will my brand appear?', a: 'Clubs manage their sponsors from the admin area and feature them on their club site, so your support is seen by the people who follow the club.' },
    ],
  },
  {
    id: 'account',
    audience: 'Account & help',
    Icon: LifeBuoy,
    color: 'var(--text-secondary)',
    pitch: 'Quick fixes for sign-in and privacy questions, and how to reach us.',
    items: [
      { q: 'I didn\'t get my sign-in email.', a: 'Check your spam or promotions folder, make sure the address is spelled correctly, and wait a minute before requesting another link. Still nothing? Email contact@itsfootball.club from the address you\'re signing in with.' },
      { q: 'Who can see my information?', a: 'Your club\'s admins can see your membership details. Public club pages show only what the club chooses to publish, such as the squad list and match stats. You can delete your account from My Clubs (/my-clubs). For any other privacy request, email contact@itsfootball.club.' },
      { q: 'Where do I get more help?', a: 'For anything about your club, such as memberships, fixtures or refunds, contact the club through the form on its page or ask a club admin. For help with itsfootball.club itself, such as sign-in problems, something not working or setting up a club, email contact@itsfootball.club.' },
    ],
  },
];
