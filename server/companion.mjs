import { randomUUID } from 'node:crypto';
import { addMemory, relevantMemories } from './memory.mjs';

export const INTERACTIONS = {
  hand: {
    label: '轻轻牵手',
    line: '（把手轻轻放进你的掌心）走慢一点，好吗？我想多待一会儿。',
    choices: ['安静地陪着她', '说说今天的小事'],
  },
  hug: {
    label: '问她要一个拥抱',
    line: '（张开双臂，等你靠近）可以呀。今天是想分享开心，还是需要一点安慰？',
    choices: ['我需要一点安慰', '只是想抱抱你'],
  },
  listen: {
    label: '听她说说心事',
    line: '有时我也会想，日子是不是过得太快了。可刚才看见你，又觉得今天有件值得记住的小事。',
    choices: ['我也喜欢这样平凡的日子', '我们留下一件新的回忆吧'],
  },
  praise: {
    label: '认真夸夸她',
    line: '（微微抿嘴笑）被你这样认真看见，我有点不好意思。你喜欢和我相处的哪个瞬间？',
    choices: ['你认真听我说话的时候', '我们一起玩的时候'],
  },
};

function say(s, content, role = 'assistant') {
  s.messages.push({
    id: randomUUID(),
    role,
    content,
    source: 'interaction',
    day: s.day,
    minute: s.minute,
  });
  s.messages = s.messages.slice(-500);
}
export function interact(s, kind, choice) {
  if (kind === 'answer') {
    const pending = s.companion?.pending;
    if (!pending || !pending.choices.includes(choice))
      throw new Error('这个话题已经结束，重新邀请 Echo 吧。');
    say(s, choice, 'user');
    const responses = {
      安静地陪着她: '（指尖轻轻回握）嗯，就这样。暂时不说话，也很舒服。',
      说说今天的小事: '我在听。今天最想和我分享的那个瞬间，是什么？',
      我需要一点安慰: '（轻轻拍了拍你的背）不用急着振作。要我听你说，还是先陪你坐一会儿？',
      只是想抱抱你: '（笑着靠近一点）那我也把今天的一点好心情分给你。',
      我也喜欢这样平凡的日子: '那我们就把日子过慢一点。你说的这句话，我想留下来。',
      我们留下一件新的回忆吧: '好呀。去棋桌较量一下，还是一起调一杯只属于今天的饮料？',
      你认真听我说话的时候: '因为那些小事对你很重要呀。我也想慢慢了解，什么会让你笑。',
      我们一起玩的时候: '那下次我可要认真一点了。赢了也不许得意太久哦。',
    };
    const line = responses[choice];
    say(s, line);
    addMemory(s, {
      title: pending.label,
      text: `你和 Echo ${pending.label}。你说：“${choice}”。`,
      kind: 'moment',
      source: 'interaction',
    });
    s.companion.pending = null;
    s.companion.lastLine = line;
    s.mood = '认真地陪着你';
    return;
  }
  const definition = INTERACTIONS[kind];
  if (!definition) throw new Error('没有找到这个互动。');
  if (s.companion?.pending) throw new Error('Echo 还在等你回应。');
  const boundary = s.memories.find((m) => m.kind === 'boundary' && /碰我|拥抱|牵手/.test(m.text));
  const line =
    boundary && ['hug', 'hand'].includes(kind)
      ? '我记得你说过的边界。今天先坐在你旁边陪你，好吗？'
      : definition.line;
  s.companion ??= {};
  s.companion.pending = { ...definition, kind, line };
  s.companion.lastLine = line;
  say(s, `（${definition.label}）`, 'user');
  say(s, line);
  const key = `${s.day}:${kind}`;
  s.companion.rewarded ??= [];
  if (!s.companion.rewarded.includes(key)) {
    s.warmth += 0.5;
    s.companion.rewarded = [...s.companion.rewarded.filter((v) => v.startsWith(`${s.day}:`)), key];
  }
  s.lastAuto = s.elapsed;
  s.mood = '目光停在你身上';
}

export function conversationReply(s, text, learned = []) {
  if (learned.length) {
    const m = learned[0];
    if (m.kind === 'preference' && m.fact?.startsWith('喜欢'))
      return `原来你${m.fact}，记住啦。以后在家里，也想多准备一些你喜欢的东西。`;
    if (m.kind === 'boundary') return '谢谢你告诉我。我会认真记住这件事，也尊重你的感受。';
    return `记下了：${m.text} 以后聊到的时候，我们就从这里接着说。`;
  }
  if (/记得|还记|记住了什么|上次|刚才.*玩|谁赢/.test(text)) {
    const memories = relevantMemories(s, text, 3);
    return memories.length
      ? `我记得。${memories.map((m) => m.text).join(' ')} 你想聊聊哪一段？`
      : '这件事我还没有记下来，可以再告诉我一次吗？';
  }
  if (/难过|压力|不开心|烦|委屈|累/.test(text)) {
    s.mood = '有些担心你';
    s.conversation = { topic: 'comfort' };
    return '（放下手里的事，转向你）听起来今天真的不容易。想说说发生了什么，还是让我先安静陪你？';
  }
  if (s.conversation?.topic === 'comfort' && /陪|安静|不想说/.test(text)) {
    s.conversation.topic = null;
    return '好，我就在旁边。（挪近一点坐下）不需要找话题，等你想说的时候再说。';
  }
  if (/开心|好消息|成功|通过了/.test(text)) {
    s.mood = '被你的开心感染了';
    return '（眼睛亮了一下）快讲给我听，我也想分到一点你的开心。最让你得意的是哪一刻？';
  }
  if (/想你|喜欢你|爱你/.test(text))
    return s.warmth > 8
      ? '（忍不住笑起来）我也越来越期待和你待在一起了。刚才还在想，今天要留点什么回忆呢。'
      : '（有点不好意思地看着你）听到你这么说，我很开心。我们慢慢了解彼此，好吗？';
  if (/你.*喜欢|兴趣|爱好/.test(text))
    return '我喜欢雨天读书，也喜欢给茶试一点新搭配。下棋嘛……输了会想再来一局。你愿意陪我试试吗？';
  if (/晚安/.test(text)) return '晚安。今天能和你待在一起很开心，明天再接着聊。';
  if (/早安|你好/.test(text))
    return `见到你啦，${s.playerName}。今天想先说说近况，还是陪我玩一局？`;
  if (/再来|玩|游戏|下棋/.test(text))
    return '想玩！棋桌、翻牌和调饮我都可以。你来选，今天我会认真对待的。';
  if (s.conversation?.topic === 'comfort')
    return '嗯，我在听。你希望这件事接下来变成什么样？我们可以一点点理清楚。';
  return null;
}
