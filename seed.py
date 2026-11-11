# -*- coding: utf-8 -*-
"""
처음 실행할 때 들어가는 '샘플 단원' 데이터입니다.
이 파일을 고칠 필요는 없어요. 선생님 관리 화면에서 단원을 편집·삭제하면 됩니다.
(data 폴더를 지우고 다시 실행하면 이 샘플로 처음부터 다시 시작해요.)
"""
import os
import secrets
import time

SAMPLE_UNIT = {
    'title': 'Sample Lesson. Our Garden Diary',
    'subtitle': '샘플 단원 · 교과서 단원이 준비되면 관리 화면에서 바꾸거나 지워 주세요',
    'words': [
        ('decide', '결정하다', 'My class decided to start a small garden.', '우리 반은 작은 정원을 시작하기로 결정했다.'),
        ('pile', '더미, 무더기', 'At first, it was just a pile of dirt and rocks.', '처음에 그곳은 그저 흙과 돌 더미였다.'),
        ('dirt', '흙, 먼지', 'Our shoes were covered with dirt.', '우리의 신발은 흙투성이였다.'),
        ('grow', '기르다, 자라다', 'Nobody knew how to grow vegetables.', '아무도 채소를 기르는 방법을 몰랐다.'),
        ('keep a diary', '일기를 쓰다', 'Our teacher told us to keep a garden diary.', '선생님께서 우리에게 정원 일기를 쓰라고 하셨다.'),
        ('thirsty', '목마른', 'The tiny green leaves looked thirsty.', '작은 초록 잎들이 목말라 보였다.'),
        ('patient', '참을성 있는', 'On rainy days, we learned to be patient.', '비 오는 날에는 참을성을 갖는 법을 배웠다.'),
        ('share', '나누다, 함께 쓰다', 'We wanted to share them with our neighbors.', '우리는 그것들을 이웃들과 나누고 싶었다.'),
        ('neighbor', '이웃', 'Our neighbors thanked us for the tomatoes.', '이웃들은 토마토를 줘서 고맙다고 했다.'),
        ('effort', '노력', 'Small efforts can make a big difference.', '작은 노력이 큰 차이를 만들 수 있다.'),
    ],
    'paragraphs': [
        [
            ('Last spring, my class decided to start a small garden behind our school.', '지난봄, 우리 반은 학교 뒤에 작은 정원을 시작하기로 결정했다.'),
            ('At first, it was just a pile of dirt and rocks.', '처음에 그곳은 그저 흙과 돌 더미였다.'),
            ('Nobody knew how to grow vegetables.', '아무도 채소를 기르는 방법을 몰랐다.'),
            ('We didn’t even know what to plant first.', '우리는 무엇을 먼저 심어야 할지조차 몰랐다.'),
        ],
        [
            ('Our teacher told us to keep a garden diary.', '선생님께서는 우리에게 정원 일기를 쓰라고 말씀하셨다.'),
            ('Every morning, we wrote down what we saw.', '매일 아침, 우리는 본 것을 적었다.'),
            ('Some days, the tiny green leaves looked thirsty, so we gave them water.', '어떤 날에는 작은 초록 잎들이 목말라 보여서 우리는 물을 주었다.'),
            ('On rainy days, we learned to be patient.', '비 오는 날에는 참을성을 갖는 법을 배웠다.'),
        ],
        [
            ('By early summer, the tomatoes were bright red.', '초여름 무렵, 토마토는 새빨갛게 익었다.'),
            ('We wanted to share them with our neighbors.', '우리는 그것들을 이웃들과 나누고 싶었다.'),
            ('Now I hope to plant sunflowers next year.', '이제 나는 내년에 해바라기를 심기를 바란다.'),
            ('Our garden taught me that small efforts can make a big difference.', '우리의 정원은 작은 노력이 큰 차이를 만들 수 있다는 것을 나에게 가르쳐 주었다.'),
        ],
    ],
    'grammar': [
        {
            'title': 'to부정사의 명사적 용법 (~하는 것, ~하기)',
            'concept': '\n'.join([
                'to + 동사원형은 ‘~하는 것, ~하기’라는 뜻으로 문장에서 명사처럼 쓰일 수 있어요.',
                '',
                'decide, want, hope, learn 같은 동사 뒤에 와서 목적어 역할을 해요.',
                '• decide to ~ : ~하기로 결정하다',
                '• want to ~ : ~하고 싶다',
                '• hope to ~ : ~하기를 바라다',
                '• learn to ~ : ~하는 것을 배우다',
                '',
                '주의! to 뒤에는 항상 동사원형이 와요. (to started ✕ → to start ○)',
            ]),
            'examples': [
                ('Last spring, my class **decided to start** a small garden behind our school.', '지난봄, 우리 반은 학교 뒤에 작은 정원을 시작하기로 결정했다.'),
                ('We **wanted to share** them with our neighbors.', '우리는 그것들을 이웃들과 나누고 싶었다.'),
                ('Now I **hope to plant** sunflowers next year.', '이제 나는 내년에 해바라기를 심기를 바란다.'),
            ],
            'quiz': [
                {
                    'question': '빈칸에 알맞은 말을 고르세요.\nWe wanted ______ them with our neighbors.',
                    'options': ['share', 'to share', 'sharing', 'to shared'], 'answer': 1,
                    'explanation': 'want는 뒤에 to부정사를 목적어로 써요. 그래서 want to share(나누고 싶다)가 알맞아요. to 뒤에는 동사원형이 와야 하므로 to shared는 틀려요.',
                },
                {
                    'question': '어법상 바른 문장을 고르세요.',
                    'options': ['I hope to plants sunflowers.', 'I hope to plant sunflowers.', 'I hope plant sunflowers.', 'I hope planting to sunflowers.'], 'answer': 1,
                    'explanation': 'hope to + 동사원형 = ~하기를 바라다. to 뒤에는 plants(✕)가 아니라 동사원형 plant가 와야 해요.',
                },
                {
                    'question': '우리말과 같은 뜻이 되도록 빈칸에 알맞은 말을 고르세요.\n우리는 참을성을 갖는 법을 배웠다. → We learned ______ patient.',
                    'options': ['be', 'to be', 'being', 'to being'], 'answer': 1,
                    'explanation': 'learn to + 동사원형 = ~하는 것을 배우다. be동사의 원형은 be이므로 to be가 알맞아요.',
                },
            ],
        },
        {
            'title': '의문사 + to부정사 (how to ~, what to ~)',
            'concept': '\n'.join([
                '‘의문사 + to + 동사원형’은 하나의 명사처럼 쓰여요.',
                '',
                '• how to + 동사원형 : ~하는 방법, 어떻게 ~할지',
                '• what to + 동사원형 : 무엇을 ~할지',
                '• where to + 동사원형 : 어디로(어디에) ~할지',
                '',
                'know, learn, tell 같은 동사 뒤에 자주 와요.',
            ]),
            'examples': [
                ('Nobody knew **how to grow** vegetables.', '아무도 채소를 기르는 방법을 몰랐다.'),
                ('We didn’t even know **what to plant** first.', '우리는 무엇을 먼저 심어야 할지조차 몰랐다.'),
            ],
            'quiz': [
                {
                    'question': '우리말과 같은 뜻이 되도록 빈칸에 알맞은 말을 고르세요.\n아무도 채소를 기르는 방법을 몰랐다. → Nobody knew ______ vegetables.',
                    'options': ['how grow', 'how to grow', 'how growing', 'to how grow'], 'answer': 1,
                    'explanation': '‘~하는 방법’은 how to + 동사원형으로 나타내요. 그래서 how to grow가 알맞아요.',
                },
                {
                    'question': 'what to plant의 뜻으로 알맞은 것을 고르세요.',
                    'options': ['무엇을 심었는지', '무엇을 심을지', '왜 심어야 하는지', '어디에 심을지'], 'answer': 1,
                    'explanation': 'what to + 동사원형 = 무엇을 ~할지. 그래서 what to plant는 ‘무엇을 심을지’예요. ‘어디에 심을지’는 where to plant예요.',
                },
            ],
        },
    ],
}

WORKSHEET_LINES = [
    'Our Garden Diary - Review Worksheet (Sample)',
    '',
    'Name: ____________     Class: ____     No.: ____',
    '',
    'A. Fill in the blanks with the words in ( ).',
    '   1. My class decided ____________ (start) a small garden.',
    '   2. Nobody knew how ____________ (grow) vegetables.',
    '   3. We wanted ____________ (share) them with our neighbors.',
    '   4. Now I hope ____________ (plant) sunflowers next year.',
    '',
    'B. Match the words with their meanings.',
    '   thirsty  /  patient  /  effort  /  neighbor',
    '   (a) someone who lives near you        ____________',
    '   (b) needing something to drink         ____________',
    '   (c) able to wait calmly                ____________',
    '   (d) hard work to do something          ____________',
    '',
    'C. What do you want to grow? Write one sentence.',
    '   I want to grow _____________________________________.',
    '',
    '* This is a sample worksheet. Replace it with your own file.',
]


def make_pdf(lines):
    """영어만 들어간 간단한 1쪽짜리 PDF를 만듭니다."""
    def esc(s):
        return s.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')

    stream = 'BT\n56 780 Td\n22 TL\n'
    for i, line in enumerate(lines):
        if i == 0:
            stream += '/F2 18 Tf\n'
        elif i == 1:
            stream += '/F1 13 Tf\n'
        stream += f'({esc(line)}) Tj T*\n'
    stream += 'ET'
    objs = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
        f'<< /Length {len(stream.encode("latin-1"))} >>\nstream\n{stream}\nendstream',
    ]
    out = '%PDF-1.4\n'
    offsets = []
    for i, obj in enumerate(objs):
        offsets.append(len(out.encode('latin-1')))
        out += f'{i + 1} 0 obj\n{obj}\nendobj\n'
    xref = len(out.encode('latin-1'))
    out += f'xref\n0 {len(objs) + 1}\n0000000000 65535 f \n'
    out += ''.join(f'{o:010d} 00000 n \n' for o in offsets)
    out += f'trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'
    return out.encode('latin-1')


def create_seed(upload_dir, new_id):
    now = int(time.time() * 1000)
    s = SAMPLE_UNIT
    unit = {
        'id': new_id('u'), 'order': 1, 'createdAt': now, 'updatedAt': now, 'status': 'published',
        'title': s['title'], 'subtitle': s['subtitle'],
        'words': [{'id': new_id('w'), 'word': w, 'meaning': m, 'example': e, 'exampleKo': k} for (w, m, e, k) in s['words']],
        'paragraphs': [{'id': new_id('p'), 'sentences': [{'id': new_id('s'), 'en': en, 'ko': ko} for (en, ko) in p]} for p in s['paragraphs']],
        'grammar': [{
            'id': new_id('g'), 'title': g['title'], 'concept': g['concept'],
            'examples': [{'id': new_id('e'), 'en': en, 'ko': ko} for (en, ko) in g['examples']],
            'quiz': [dict({'id': new_id('q')}, **q) for q in g['quiz']],
        } for g in s['grammar']],
    }

    pdf = make_pdf(WORKSHEET_LINES)
    stored = f'sample-{secrets.token_hex(4)}.pdf'
    with open(os.path.join(upload_dir, stored), 'wb') as f:
        f.write(pdf)

    return {
        'settings': {'currentUnitId': unit['id'], 'classCode': 'JOJONG'},
        'units': [unit],
        'worksheets': [{
            'id': new_id('ws'), 'unitId': unit['id'], 'title': '샘플 학습지 · 본문 복습', 'description': 'to부정사 빈칸 채우기와 단어 뜻 연결하기 (1쪽)',
            'fileName': 'OurGardenDiary_Worksheet.pdf', 'ext': 'pdf', 'stored': stored, 'size': len(pdf), 'status': 'published', 'createdAt': now, 'updatedAt': now,
        }],
        'notices': [{
            'id': new_id('n'), 'unitId': None, 'status': 'published', 'createdAt': now, 'updatedAt': now,
            'title': '연지쌤 영어 다이어리에 오신 것을 환영해요!',
            'body': '단원을 눌러 단어 → 본문 → 문법 순서로 공부해 보세요.\n공부하다 모르는 부분은 그 단원의 ‘선생님께 질문’에 남겨 주세요. 질문과 답변은 나와 선생님만 볼 수 있어요.',
        }],
        'questions': [],
        'assignments': [{
            'id': new_id('as'), 'unitId': unit['id'], 'status': 'published', 'createdAt': now, 'updatedAt': now,
            'dueDate': time.strftime('%Y-%m-%d', time.localtime(time.time() + 7 * 86400)),
            'title': '샘플 과제 · 단어 5개 써서 사진 올리기',
            'description': 'Our Garden Diary 단어 중 5개를 골라 공책에 영어 단어와 뜻을 두 번씩 쓰고, 사진을 찍어 올려 주세요.\n밝은 곳에서 글씨가 잘 보이게 찍어요.',
        }],
        'submissions': [],
        'students': [],
        'sessions': {},
    }
