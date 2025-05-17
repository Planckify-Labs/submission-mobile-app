import * as Clipboard from 'expo-clipboard';
import { router } from "expo-router";
import { Check, Copy, Info, Shield } from "lucide-react-native";
import React from "react";
import { Alert, Pressable, Text, View } from "react-native";

export type WalletCreationStep = {
  title: string;
  content: React.ReactNode;
  buttonText: string;
  onButtonPress: () => void;
};

export const createWalletSteps = (
  mnemonic: string[],
  setCurrentStep: (step: number) => void,
  isChecked: boolean,
  setIsChecked: (checked: boolean) => void,
  verificationIndices: number[],
  wordOptions: {[key: number]: string[]},
  selectedWords: {[key: number]: string},
  handleSelectWord: (wordIndex: number, word: string) => void
): WalletCreationStep[] => [
  {
    title: "Let's Set Up Your Wallet",
    content: (
      <>
        <View className="bg-light rounded-xl p-4 mb-6 shadow-sm">
          <View className="flex-row items-center mb-4">
            <Shield color="#c71c4b" size={24} className="mr-2" />
            <Text className="text-light-matte-black font-medium">TakumiPay Wallet Setup</Text>
          </View>
          <Text className="text-light-matte-black mb-4">
            TakumiPay gives you your own decentralized wallet — a private vault for your tokens and digital assets.
          </Text>
          
          <Text className="text-light-matte-black mb-4">
            No signup, no bank, no middlemen. Just you and your crypto.
          </Text>
        </View>
        
        <View className="bg-light rounded-xl p-4 shadow-sm">
          <Text className="text-light-matte-black">
            By the end of this short process, you'll have a secure wallet that gives you full control.
          </Text>
        </View>
      </>
    ),
    buttonText: "Get Started",
    onButtonPress: () => setCurrentStep(1),
  },
  {
    title: "What Is a Wallet, Really?",
    content: (
      <>
        <View className="bg-light rounded-xl p-4 mb-6 shadow-sm">
          <Text className="text-light-matte-black mb-4">
            A crypto wallet stores the private keys that control your assets. Think of it as your bank vault, but only you have the key.
          </Text>
          
          <Text className="text-light-matte-black font-medium mb-2">
            Your wallet lets you:
          </Text>
          
          <View className="mb-2">
            <View className="flex-row mb-2">
              <Text className="text-light-primary-red mr-2">•</Text>
              <Text className="text-light-matte-black">Receive and send tokens</Text>
            </View>
            
            <View className="flex-row mb-2">
              <Text className="text-light-primary-red mr-2">•</Text>
              <Text className="text-light-matte-black">Swap assets on TakumiPay</Text>
            </View>
            
            <View className="flex-row mb-2">
              <Text className="text-light-primary-red mr-2">•</Text>
              <Text className="text-light-matte-black">Purchase data package,Pulsa, electricity, and more</Text>
            </View>
            
            <View className="flex-row mb-2">
              <Text className="text-light-primary-red mr-2">•</Text>
              <Text className="text-light-matte-black">Participate in governance with $TKMY</Text>
            </View>
          </View>
        </View>
        
        <View className="bg-light rounded-xl p-4 shadow-sm">
          <Text className="text-light-matte-black mb-2">
            And most importantly: You own everything in it.
          </Text>
          
          <Text className="text-light-matte-black">
            No email. No username. Just a secret phrase only you will see.
          </Text>
        </View>
      </>
    ),
    buttonText: "Continue",
    onButtonPress: () => setCurrentStep(2),
  },
  {
    title: "Your Secret Recovery Phrase",
    content: (
      <>
        <View className="bg-light rounded-xl p-4 mb-6 shadow-sm">
          <Text className="text-light-matte-black mb-4">
            Your secret recovery phrase is the only way to recover your wallet if you lose your device. Without it, there's no way to access your funds.
          </Text>
          
          <View className="flex-row flex-wrap gap-2 mb-4">
            {mnemonic.map((word, index) => (
              <View key={index} className="bg-light-main-container rounded-md py-2 px-3 w-[30%]">
                <Text className="text-light-matte-black">{index + 1}. {word}</Text>
              </View>
            ))}
          </View>
          
          <Pressable 
            className="flex-row items-center justify-center mb-4 bg-light-main-container border border-gray-300 py-2 rounded-md"
            onPress={() => {
              Clipboard.setStringAsync(mnemonic.join(' '));
              Alert.alert("Copied", "Secret phrase copied to clipboard");
            }}
          >
            <Copy size={16} color="#c71c4b" className="mr-2" />
            <Text className="text-light-matte-black">Copy to Clipboard</Text>
          </Pressable>
        </View>
        
        <View className="bg-light-primary-red/10 border border-light-primary-red/20 rounded-xl p-4 mb-6 flex-row gap-2">
          <Info size={20} color="#c71c4b" className="mr-2" />
          <Text className="text-light-matte-black flex-1">
            Never share this phrase with anyone. TakumiPay will never ask for it
          </Text>
        </View>
        
        <Pressable 
          className="flex-row items-center mb-4" 
          onPress={() => setIsChecked(!isChecked)}
        >
          <View className={`w-6 h-6 border rounded mr-2 ${isChecked ? 'bg-light-primary-red border-light-primary-red' : 'border-gray-400'} items-center justify-center`}>
            {isChecked && <Text className="text-light">
              <Check size={16} color="white" strokeWidth={3} />
              </Text>}
          </View>
          <Text className="text-light-matte-black">
            I have written it down on paper or stored in an encrypted note app
          </Text>
        </Pressable>
      </>
    ),
    buttonText: "Continue",
    onButtonPress: () => {
      if (!isChecked) {
        Alert.alert(
          "Confirmation Required", 
          "Please confirm you've saved your secret phrase somewhere safe",
          [{ text: "OK" }]
        );
      } else {
        setCurrentStep(3);
      }
    },
  },
  {
    title: "Confirm Secret Phrase",
    content: (
      <>
        <View className="bg-light rounded-xl p-4 mb-6 shadow-sm">
          <Text className="text-light-matte-black mb-4">
            Please tap on the correct answer below.
          </Text>
          
          {verificationIndices.map((wordIndex, i) => (
            <VerificationRow
              key={i}
              wordIndex={wordIndex}
              options={wordOptions[wordIndex] || []}
              selectedWord={selectedWords[wordIndex]}
              onSelectWord={(word) => handleSelectWord(wordIndex, word)}
            />
          ))}
        </View>
      </>
    ),
    buttonText: "Confirm",
    onButtonPress: () => {
      const allCorrect = verificationIndices.every(
        index => selectedWords[index] === mnemonic[index]
      );
      
      if (!allCorrect) {
        Alert.alert(
          "Incorrect Words", 
          "Please select the correct words from your secret phrase",
          [{ text: "Try Again" }]
        );
      } else {
        setCurrentStep(4);
      }
    },
  },
  {
    title: "Wallet Created!",
    content: (
      <>
        <View className="items-center mb-6">
          <View className="bg-light w-16 h-16 rounded-full items-center justify-center mb-4 shadow-sm">
            <View className="w-8 h-8 border-2 border-light-primary-red rounded-md items-center justify-center">
              <Text className="text-light-primary-red font-bold">$</Text>
            </View>
          </View>
          <Text className="text-light-matte-black text-2xl font-bold mb-2">Your Wallet is Ready</Text>
          <Text className="text-light-matte-black text-center">
            You're now in control of your TakumiPay wallet. You can start exploring DeFi, swapping tokens, and participating in governance
          </Text>
        </View>
      </>
    ),
    buttonText: "Enter my wallet",
    onButtonPress: () => router.push("/"),
  },
];

const VerificationRow = ({ 
  wordIndex, 
  options, 
  selectedWord, 
  onSelectWord 
}: { 
  wordIndex: number; 
  options: string[]; 
  selectedWord: string | undefined; 
  onSelectWord: (word: string) => void;
}) => {
  return (
    <View className="mb-6">
      <Text className="text-light-matte-black font-medium mb-2">Word #{wordIndex + 1}</Text>
      <View className="flex-row gap-2">
        {options.map((word, optionIndex) => (
          <WordOption 
            key={optionIndex}
            word={word}
            isSelected={selectedWord === word}
            onSelect={() => onSelectWord(word)}
          />
        ))}
      </View>
    </View>
  );
};

const WordOption = ({ 
  word, 
  isSelected, 
  onSelect 
}: { 
  word: string; 
  isSelected: boolean; 
  onSelect: () => void;
}) => {
  return (
    <Pressable 
      className={`flex-1 py-3 px-2 rounded-md items-center justify-center ${
        isSelected ? 'bg-light-primary-red/20' : 'bg-light-main-container'
      }`}
      onPress={onSelect}
    >
      <Text className={`${
        isSelected ? 'text-light-primary-red font-bold' : 'text-light-matte-black'
      }`}>
        {word}
      </Text>
    </Pressable>
  )
}