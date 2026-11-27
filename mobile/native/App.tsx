import React, {useState} from 'react';
import {ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, TextInput, View, ScrollView} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {apiRequest} from './src/network/api';
import {persistVerifiedSession, validateSession, clearLocalSession, type Session} from './src/network/session';

export default function App() {
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [session,setSession]=useState<Session|null>(null);
  const [role,setRole]=useState('');
  const valid=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && password.length>0;
  async function login(){
    if(!valid||busy)return;
    setBusy(true);setError('');
    try {
      const next=await apiRequest<Session>('/api/auth/login',{method:'POST',body:JSON.stringify({email:email.trim(),password})});
      if(!next.accountId||!next.accessToken||!next.refreshToken||!Number.isFinite(next.expiresAt))throw new Error('Session invalide');
      const profile=await validateSession(next);
      if(profile.role!=='driver'&&profile.role!=='rider')throw new Error('Rôle non pris en charge');
      await persistVerifiedSession(next);
      setPassword('');setRole(profile.role);setSession(next);
    } catch(e){setError(e instanceof Error?e.message:'Connexion impossible');}
    finally{setBusy(false);}
  }
  async function logout(){
    if(!session||busy)return;
    setBusy(true);setError('');
    try{await clearLocalSession(session.accountId);setSession(null);setRole('');}
    catch{setError('Impossible d’effacer la session locale');}
    finally{setBusy(false);}
  }
  return <SafeAreaProvider><StatusBar barStyle="light-content" backgroundColor="#0e0f12"/><SafeAreaView style={s.screen}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <Text style={s.brand}>Stras<Text style={s.gold}>Drive</Text></Text>
      <View style={s.card}>
      {session?<><Text style={s.heading}>{role==='driver'?'Espace chauffeur':'Espace passager'}</Text><Text style={s.secondary}>Interface native en développement</Text><Pressable disabled={busy} onPress={logout} style={s.button}><Text style={s.buttonText}>Déconnexion</Text></Pressable></>:<>
      <Text style={s.heading}>Connexion</Text>
      <Text style={s.label}>E-mail</Text><TextInput accessibilityLabel="E-mail" style={s.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" placeholder="Votre adresse e-mail" placeholderTextColor="#a8a29e" editable={!busy}/>
      {email.length>0&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())?<Text style={s.error}>Adresse e-mail invalide</Text>:null}
      <Text style={s.label}>Mot de passe</Text><TextInput accessibilityLabel="Mot de passe" style={s.input} value={password} onChangeText={setPassword} secureTextEntry textContentType="password" placeholder="Votre mot de passe" placeholderTextColor="#a8a29e" editable={!busy}/>
      <Pressable accessibilityRole="button" disabled={!valid||busy} onPress={login} style={[s.button,(!valid||busy)&&{opacity:0.5}]}>{busy?<ActivityIndicator color="#0e0f12"/>:<Text style={s.buttonText}>Se connecter</Text>}</Pressable>
      </>}
      {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
      </View>
    </ScrollView>
  </SafeAreaView></SafeAreaProvider>;
}
const s=StyleSheet.create({
screen:{flex:1,backgroundColor:'#0e0f12'},content:{flexGrow:1,justifyContent:'center',padding:24},brand:{fontSize:36,fontWeight:'700',color:'#fafaf9',textAlign:'center',marginBottom:32},gold:{color:'#eab308'},card:{backgroundColor:'#17212d',borderRadius:20,padding:24},heading:{fontSize:24,fontWeight:'700',color:'#fafaf9',marginBottom:16},label:{color:'#fafaf9',marginTop:12,marginBottom:8},input:{backgroundColor:'#0e0f12',color:'#fafaf9',borderRadius:10,padding:14,fontSize:16},button:{backgroundColor:'#eab308',padding:16,borderRadius:12,alignItems:'center',marginTop:24},buttonText:{color:'#0e0f12',fontWeight:'700',fontSize:16},secondary:{color:'#a8a29e'},error:{color:'#fca5a5',marginTop:10}
});
