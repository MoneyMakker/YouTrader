import React, { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Animated, Easing, PanResponder, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { AudioLines, BarChart3, Bell, BriefcaseBusiness, CalendarDays, ChartNoAxesCombined, Check, ChevronLeft, FileImage, Flag, Mic, ShieldCheck, Target, WalletCards } from "lucide-react-native";
import { YdlButton } from "../../ydl/components/YdlButton";
import { YdlText } from "../../ydl/components/YdlText";
import { useYdlTheme } from "../../ydl/tokens";
import { YDL_MIN_TOUCH_TARGET } from "../../ydl/accessibility";
import type { AcquisitionPhase } from "./acquisitionState";

const SLIDE_KEY = "yt-value-onboarding-slide";
const PROFILE_KEY = "yt-trader-profile-v1";
const GREEN = "#A3FF12";

type Props = { phase: AcquisitionPhase; onPhaseChange: (phase: AcquisitionPhase) => void; onComplete: (profile?: string) => void; onExistingAuth: () => void };

const PROFILE_OPTIONS = [
  ["new", "onboarding.profile.new", "onboarding.profile.newBody", "sparkles"],
  ["challenge", "onboarding.profile.challenge", "onboarding.profile.challengeBody", "target"],
  ["funded", "onboarding.profile.funded", "onboarding.profile.fundedBody", "shield"],
] as const;

const STEPS = [
  { key: "workspace", title: "onboarding.value.workspaceTitle", body: "onboarding.value.workspaceBody", eyebrow: "onboarding.value.workspaceEyebrow" },
  { key: "futures", title: "onboarding.value.futuresTitle", body: "onboarding.value.futuresBody", eyebrow: "onboarding.value.futuresEyebrow" },
  { key: "context", title: "onboarding.value.contextTitle", body: "onboarding.value.contextBody", eyebrow: "onboarding.value.contextEyebrow" },
  { key: "edge", title: "onboarding.value.edgeTitle", body: "onboarding.value.edgeBody", eyebrow: "onboarding.value.edgeEyebrow" },
] as const;
const PROFILES = [
  ["new", "onboarding.profile.new", "onboarding.profile.newBody", "sparkles"],
  ["challenge", "onboarding.profile.challenge", "onboarding.profile.challengeBody", "target"],
  ["funded", "onboarding.profile.funded", "onboarding.profile.fundedBody", "shield"],
] as const;

function Pulse({ reduceMotion }: { reduceMotion: boolean }) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(value, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduceMotion]);
  return <Animated.View pointerEvents="none" style={[styles.pulse, { opacity: value.interpolate({ inputRange: [0,1], outputRange: [0.05,0.14] }), transform: [{ scale: value.interpolate({ inputRange: [0,1], outputRange: [1,1.08] }) }] }]} />;
}

function FeatureScene({ kind, reduceMotion }: { kind: string; reduceMotion: boolean }) {
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) { progress.setValue(1); return; }
    Animated.timing(progress, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [kind, reduceMotion]);
  const rise = progress.interpolate({ inputRange: [0,1], outputRange: [16,0] });
  if (kind === "workspace") return <Animated.View style={[styles.sceneCard, { opacity: progress, transform: [{ translateY: rise }] }]}><View style={styles.sceneHeader}><YdlText role="caption" color="text.secondary">MES · NY SESSION</YdlText><View style={styles.attachChip}><FileImage size={12} color={GREEN}/><YdlText role="caption" style={styles.greenText}>2</YdlText></View></View><View style={styles.voiceRow}><View style={styles.micCircle}><Mic size={17} color={GREEN}/></View><View style={styles.wave}>{[8,18,12,24,15,28,11,20,14,22,9].map((h,i)=><Animated.View key={i} style={[styles.waveBar,{height:h,opacity:progress}]} />)}</View><YdlText role="caption" color="text.secondary">0:18</YdlText></View><View style={styles.noteRow}><YdlText role="bodyEmphasized">London open</YdlText><YdlText role="caption" color="text.secondary">Rejection at prior high. Waited for confirmation.</YdlText></View><View style={styles.thumbRow}><View style={styles.chartThumb}><ChartNoAxesCombined size={22} color={GREEN}/></View><View style={styles.chartThumb}><FileImage size={21} color="rgba(255,255,255,0.55)"/></View><YdlText role="caption" color="text.secondary">Trade notes saved</YdlText></View></Animated.View>;
  if (kind === "futures") return <Animated.View style={[styles.sceneCard, { opacity: progress, transform: [{ translateY: rise }] }]}><View style={styles.sceneHeader}><YdlText role="bodyEmphasized">$50K Challenge</YdlText><YdlText role="caption" color="text.secondary">Phase 1</YdlText></View><View style={styles.targetTrack}><Animated.View style={[styles.targetFill,{width:progress.interpolate({inputRange:[0,1],outputRange:["0%","54%"]})}]} /></View><View style={styles.metricGrid}>{[["Target","$3,000"],["Daily Buffer","$1,000"],["Risk / Trade","$150"],["Contracts","3 MES"]].map(([a,b])=><View key={a} style={styles.metric}><YdlText role="caption" color="text.secondary">{a}</YdlText><YdlText role="bodyEmphasized">{b}</YdlText></View>)}</View><View style={styles.calcRow}><WalletCards size={17} color={GREEN}/><YdlText role="caption" color="text.secondary">Position size calculator</YdlText><YdlText role="bodyEmphasized" style={styles.greenText}>3 MES</YdlText></View></Animated.View>;
  if (kind === "context") return <Animated.View style={[styles.sceneCard, { opacity: progress, transform: [{ translateY: rise }] }]}><View style={styles.sceneHeader}><YdlText role="bodyEmphasized">Market context</YdlText><View style={styles.alertChip}><Bell size={12} color="#FFD166"/><YdlText role="caption" style={styles.yellowText}>Alert</YdlText></View></View><View style={styles.eventRow}><View style={[styles.eventDot,{backgroundColor:"#FF5C5C"}]}/><View style={styles.eventText}><YdlText role="caption" color="text.secondary">8:30 AM · HIGH IMPACT</YdlText><YdlText role="bodyEmphasized">CPI</YdlText></View><CalendarDays size={18} color="rgba(255,255,255,0.5)"/></View><View style={styles.eventRow}><View style={[styles.eventDot,{backgroundColor:"#FFD166"}]}/><View style={styles.eventText}><YdlText role="caption" color="text.secondary">10:00 AM · MEDIUM</YdlText><YdlText role="bodyEmphasized">Consumer Sentiment</YdlText></View></View><View style={styles.newsRow}><TrendingLine/><YdlText role="caption" color="text.secondary">US futures move ahead of inflation data</YdlText></View></Animated.View>;
  return <Animated.View style={[styles.sceneCard, { opacity: progress, transform: [{ translateY: rise }] }]}><View style={styles.statTop}><View><YdlText role="caption" color="text.secondary">Win Rate</YdlText><YdlText role="title">61%</YdlText></View><View><YdlText role="caption" color="text.secondary">Avg. R</YdlText><YdlText role="title">1.8</YdlText></View><View style={styles.onTrack}><ShieldCheck size={15} color={GREEN}/><YdlText role="caption" style={styles.greenText}>On Track</YdlText></View></View><EquityLine/><View style={styles.weakness}><YdlText role="caption" color="text.secondary">MAIN PATTERN</YdlText><YdlText role="bodyEmphasized">Overtrading after a loss</YdlText><View style={styles.discipline}><YdlText role="caption" color="text.secondary">Discipline 78</YdlText><View style={styles.smallTrack}><View style={[styles.smallFill,{width:"78%"}]}/></View></View></View></Animated.View>;
}
function TrendingLine(){return <View style={styles.trending}><View style={styles.tinyLine}/><View style={[styles.tinyLine,{width:25,transform:[{rotate:"-8deg"}]}]}/></View>}
function EquityLine(){return <View style={styles.equity}><View style={styles.eqSegment}/><View style={[styles.eqSegment,{width:45,transform:[{rotate:"18deg"}]}]}/><View style={[styles.eqSegment,{width:55,transform:[{rotate:"-8deg"}]}]}/><View style={[styles.eqSegment,{width:34,transform:[{rotate:"18deg"}]}]}/></View>}

export function ValueOnboarding({ phase, onPhaseChange, onComplete, onExistingAuth }: Props) {
  const { t } = useTranslation(); const theme = useYdlTheme("dark"); const insets = useSafeAreaInsets();
  const [index,setIndex]=useState(0); const [profile,setProfile]=useState<string|null>(null); const [reduceMotion,setReduceMotion]=useState(false); const transitionX = useRef(new Animated.Value(0)).current;
  const step=STEPS[index]; const personalization=phase === "onboarding_personalization";
  useEffect(()=>{ import("react-native").then(({AccessibilityInfo})=>{AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion); const s=AccessibilityInfo.addEventListener("reduceMotionChanged",setReduceMotion); return ()=>s.remove();});},[]);
  if(personalization) return <View style={[styles.root,{backgroundColor:theme.colors.background.primary,paddingTop:Math.max(insets.top,16),paddingBottom:Math.max(insets.bottom,16)}]} testID="value-onboarding-personalization"><Pressable onPress={()=>onComplete()} style={styles.topLink}><YdlText role="bodyEmphasized" color="text.secondary">{t("skip")}</YdlText></Pressable><View style={styles.content}><YdlText role="caption" color="action.primary" style={styles.eyebrow}>{t("onboarding.personalization.eyebrow")}</YdlText><YdlText role="title" style={styles.title}>{t("onboarding.personalization.title")}</YdlText><YdlText role="body" color="text.secondary" style={styles.body}>{t("onboarding.personalization.body")}</YdlText><View style={styles.options}>{PROFILE_OPTIONS.map(([key,title,body,icon])=><Pressable key={key} onPress={()=>setProfile(key)} style={[styles.option,profile===key&&styles.optionSelected]}><View style={styles.optionIcon}>{icon === "target" ? <Target size={20} color={GREEN}/> : icon === "shield" ? <ShieldCheck size={20} color={GREEN}/> : <BarChart3 size={20} color={GREEN}/>}</View><View style={{flex:1}}><YdlText role="bodyEmphasized">{t(title)}</YdlText><YdlText role="caption" color="text.secondary">{t(body)}</YdlText></View>{profile===key?<Check size={20} color={GREEN}/>:null}</Pressable>)}</View></View><View style={styles.footer}><Pressable onPress={onExistingAuth}><YdlText role="bodyEmphasized" color="text.secondary">{t("onboarding.alreadyAccount")}</YdlText></Pressable><YdlButton label={t("onboarding.continue")} onPress={()=>onComplete(profile||undefined)} disabled={!profile} fullWidth/></View></View>;
  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(STEPS.length - 1, next));
    if (clamped === index) return;
    Animated.sequence([
      Animated.timing(transitionX, { toValue: next > index ? -18 : 18, duration: 120, useNativeDriver: true }),
      Animated.timing(transitionX, { toValue: 0, duration: 230, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    setIndex(clamped);
  };
  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx < -45) goTo(index + 1);
      else if (gesture.dx > 45) goTo(index - 1);
    },
  })).current;

  return <View style={[styles.root,{backgroundColor:theme.colors.background.primary,paddingTop:Math.max(insets.top,16),paddingBottom:Math.max(insets.bottom,16)}]} testID="value-onboarding"><View style={styles.topRow}><Pressable onPress={onExistingAuth}><YdlText role="bodyEmphasized" color="text.secondary">{t("onboarding.alreadyAccount")}</YdlText></Pressable><Pressable onPress={()=>onComplete()} style={styles.skip}><YdlText role="bodyEmphasized" color="text.secondary">{t("skip")}</YdlText></Pressable></View><Animated.View {...panResponder.panHandlers} style={[styles.content,{transform:[{translateX:transitionX}]}]}><YdlText role="caption" color="action.primary" style={styles.eyebrow}>{t(`onboarding.value.${step.key}Eyebrow`)}</YdlText><YdlText role="title" style={styles.title}>{t(step.title)}</YdlText><YdlText role="body" color="text.secondary" style={styles.body}>{t(step.body)}</YdlText><FeatureScene kind={step.key} reduceMotion={reduceMotion}/></Animated.View><View style={styles.dots}>{STEPS.map((s,i)=><View key={s.key} style={[styles.dot,{backgroundColor:i===index?theme.colors.action.primary:theme.colors.border.subtle}]}/>)}</View><View style={styles.footer}>{index>0?<Pressable onPress={()=>setIndex(v=>v-1)} style={styles.back}><ChevronLeft size={22} color={theme.colors.text.secondary}/></Pressable>:<View style={styles.back}/>}<YdlButton label={index===STEPS.length-1?t("onboarding.seePlans"):t("onboarding.continue")} onPress={()=>index===STEPS.length-1?onPhaseChange("onboarding_personalization"):goTo(index+1)} fullWidth/></View></View>;
}

const styles=StyleSheet.create({pulse:{position:"absolute",width:260,height:260,borderRadius:130,backgroundColor:"rgba(163,255,18,0.05)"},alertChip:{flexDirection:"row",alignItems:"center",gap:4,paddingHorizontal:8,paddingVertical:4,borderRadius:10,backgroundColor:"rgba(255,209,102,0.08)"},root:{flex:1,paddingHorizontal:20},topRow:{minHeight:YDL_MIN_TOUCH_TARGET,alignItems:"center",justifyContent:"space-between",flexDirection:"row"},topLink:{minHeight:YDL_MIN_TOUCH_TARGET,justifyContent:"center",alignSelf:"flex-end"},skip:{minHeight:YDL_MIN_TOUCH_TARGET,justifyContent:"center",paddingHorizontal:4,alignSelf:"flex-end"},content:{flex:1,justifyContent:"center",gap:14,transform:[{translateY:-12}]},eyebrow:{letterSpacing:1.3},title:{maxWidth:360},body:{maxWidth:370,lineHeight:22},sceneCard:{borderRadius:22,borderWidth:1,borderColor:"rgba(255,255,255,0.12)",backgroundColor:"rgba(255,255,255,0.045)",padding:18,gap:14,overflow:"hidden"},sceneHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},attachChip:{flexDirection:"row",alignItems:"center",gap:4},greenText:{color:GREEN},yellowText:{color:"#FFD166"},voiceRow:{flexDirection:"row",alignItems:"center",gap:10},micCircle:{width:32,height:32,borderRadius:16,backgroundColor:"rgba(163,255,18,0.1)",alignItems:"center",justifyContent:"center"},wave:{flex:1,height:30,flexDirection:"row",alignItems:"center",gap:3},waveBar:{width:3,borderRadius:2,backgroundColor:GREEN},noteRow:{gap:3},thumbRow:{flexDirection:"row",alignItems:"center",gap:8},chartThumb:{width:42,height:34,borderRadius:8,borderWidth:1,borderColor:"rgba(255,255,255,0.14)",backgroundColor:"rgba(0,0,0,0.3)",alignItems:"center",justifyContent:"center"},targetTrack:{height:8,borderRadius:4,backgroundColor:"rgba(255,255,255,0.1)",overflow:"hidden"},targetFill:{height:8,borderRadius:4,backgroundColor:GREEN},metricGrid:{flexDirection:"row",flexWrap:"wrap",gap:8},metric:{width:"47%",gap:3},calcRow:{flexDirection:"row",alignItems:"center",gap:8,paddingTop:8,borderTopWidth:1,borderTopColor:"rgba(255,255,255,0.08)"},eventRow:{flexDirection:"row",alignItems:"center",gap:10,paddingVertical:5},eventDot:{width:8,height:8,borderRadius:4},eventText:{flex:1,gap:2},newsRow:{flexDirection:"row",alignItems:"center",gap:8,paddingTop:8,borderTopWidth:1,borderTopColor:"rgba(255,255,255,0.08)"},trending:{flexDirection:"row",alignItems:"center",gap:3,width:40},tinyLine:{width:14,height:2,backgroundColor:GREEN,transform:[{rotate:"14deg"}]},statTop:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},onTrack:{flexDirection:"row",alignItems:"center",gap:4},equity:{height:34,flexDirection:"row",alignItems:"center",gap:3},eqSegment:{height:2,width:40,backgroundColor:GREEN,transform:[{rotate:"-12deg"}]},weakness:{gap:4,paddingTop:8,borderTopWidth:1,borderTopColor:"rgba(255,255,255,0.08)"},discipline:{marginTop:3,gap:3},smallTrack:{height:5,borderRadius:3,backgroundColor:"rgba(255,255,255,0.1)"},smallFill:{height:5,width:"78%",borderRadius:3,backgroundColor:GREEN},dots:{flexDirection:"row",gap:6,justifyContent:"center",marginBottom:10},dot:{width:22,height:4,borderRadius:2},footer:{paddingBottom:8,gap:8,flexDirection:"row",alignItems:"center"},back:{width:42,minHeight:44,justifyContent:"center",alignItems:"center"},options:{gap:10,marginTop:10},option:{minHeight:68,borderRadius:17,borderWidth:1,borderColor:"rgba(255,255,255,0.14)",backgroundColor:"rgba(255,255,255,0.04)",paddingHorizontal:14,paddingVertical:10,flexDirection:"row",alignItems:"center",gap:12},optionSelected:{borderColor:GREEN,backgroundColor:"rgba(163,255,18,0.1)",transform:[{scale:1.01}]},optionIcon:{width:38,height:38,borderRadius:12,backgroundColor:"rgba(163,255,18,0.08)",alignItems:"center",justifyContent:"center"}});
