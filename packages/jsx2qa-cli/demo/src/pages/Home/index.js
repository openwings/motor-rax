import { Component } from 'rax';
import View from 'rax-view';
import Text from '@ali/motor-rax-text';
import C from './component';

export default function Home() {

  return (
    <View>
      <Text>Hello rax quickapp.</Text>
      <C />
    </View>
  )
}
