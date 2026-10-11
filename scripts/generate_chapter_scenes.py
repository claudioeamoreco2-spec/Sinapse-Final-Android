#!/usr/bin/env python3
"""Create original local narrative illustrations without altering recovered sources.

Every caption and its page are checked against the recovered chapter text. No
network, remote font or original image is used. Only this script's 36 SVG assets
and chapter-scenes.js are generated. The viewBox stays crisp on Android screens.
"""
import hashlib
import html
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "app/src/main/assets"
DEST = ASSETS / "scenes/illustrated"

# (number, kind, caption, exact source excerpt, palette)
SCENES = [
    (1, "storm-city", "A metrópole sob os relâmpagos roxos da tempestade.", "Os relâmpagos que cortavam os céus não eram brancos", "violet"),
    (1, "classroom", "Na sala de aula abandonada, Oliver coleta o sangue de Caleb.", "Oliver se aproximou com uma seringa", "violet"),
    (1, "street-circle", "O último círculo de energia de Caleb se espalha pelo asfalto molhado.", "Um círculo de energia se expandiu dele", "violet"),
    (2, "first-lightning", "Um trovão púrpura atinge Caleb nas ruas de Nerakar.", "Um trovão púrpura desceu dos céus e atingiu Caleb", "violet"),
    (2, "void", "No vazio, Caleb encara o núcleo púrpura que pulsa como um coração.", "um núcleo, pulsando como um coração", "void"),
    (2, "rescue", "Caleb liberta a mulher das ferragens enquanto Oliver segura as criaturas.", "A mulher caiu nos braços de Caleb", "rust"),
    (3, "healing-house", "Lira troca os curativos de Caleb na pequena casa de madeira.", "tentando trocar os curativos", "gold"),
    (3, "eron-forest", "Na floresta, os golpes de Caleb não conseguem mover Eron.", "O velho continua exatamente onde estava", "forest"),
    (3, "fusion", "A lembrança da Sinapse Final: macas, fios e a fusão que deixou ecos em Eron.", "conectados por fios, tubos e máquinas", "rust"),
    (4, "conductor", "Miro encontra o Condutor Elemental no templo subterrâneo.", "uma peça esférica que pulsava em tons verdes e âmbar", "forest"),
    (4, "shield", "Lazhar abre o escudo hexagonal para alcançar Miro durante a fuga.", "formando um escudo de energia hexagonal", "cyan"),
    (4, "crypt", "O Anel de Tharzul permanece cercado pelas correntes de prata viva.", "correntes de prata viva", "cyan"),
    (5, "ghost-corridor", "A garota fantasma, coberta de runas, aparece no corredor envolto em névoa.", "Sua pele agora brilha com runas vivas", "cyan"),
    (5, "conductor-bunker", "Oliver e Lazhar estudam o Condutor Elemental no bunker.", "Oliver está diante do Condutor Elemental", "violet"),
    (5, "ghost-touch", "Entre os ecos de quarenta e cinco vidas, a garota toca Caleb com um brilho intenso.", "Ela o toca. Um brilho violento o envolve", "void"),
    (6, "bottle-training", "Eron ensina Caleb a acertar a garrafa sem destruir a pedra.", "Uma pequena descarga púrpura atingiu a garrafa", "gold"),
    (6, "heart-split", "O Coração de Kaelum se divide: uma metade alcança o peito de Caleb e a outra sobe.", "O núcleo começou a se dividir", "void"),
    (6, "buried-machine", "Na floresta, Eron reconhece os cabos e símbolos da estrutura de Baltazar.", "construção parcialmente enterrada", "forest"),
    (7, "ring-temple", "Oliver encontra o Anel flutuando sobre o pedestal negro do antigo templo.", "O Anel estava flutuando sobre um pedestal negro", "violet"),
    (7, "ring-binding", "O feixe do pedestal alcança Oliver, que cai de joelhos no templo.", "Um feixe de luz saiu do pedestal", "violet"),
    (7, "throne-vision", "A visão de um homem no trono mostra cinco símbolos ligados aos fugitivos.", "Um homem sentado em um trono", "void"),
    (8, "forest-run", "Oliver corre pela névoa, enquanto as cinco marcas reaparecem em suas visões.", "cinco marcas brilhando diante de seus olhos", "forest"),
    (8, "bunker-loss", "Oliver encontra seus cinco companheiros imóveis na base silenciosa.", "No centro da sala principal, encontrou os cinco", "rust"),
    (8, "cloud-platform", "Acima das nuvens, Sael e Ágata observam a metade do Coração de Kaelum.", "A metade do Coração de Kaelum flutuava entre os dois", "cyan"),
    (9, "grief", "Oliver se ajoelha entre os companheiros que haviam escolhido seguir seu caminho.", "Ele caiu de joelhos", "rust"),
    (9, "harkan-reveal", "Durante o confronto, o falso Sael revela seu nome: Harkan.", "Os olhos ficaram púrpura", "violet"),
    (9, "wall-battle", "O Anel de Oliver enfrenta os artefatos de Harkan na base destruída.", "O primeiro impacto destruiu parte da parede", "rust"),
    (10, "forest-duel", "Harkan combina vento, gelo, fogo e levitação no combate contra Oliver.", "O gelo cobriu parte do chão", "cyan"),
    (10, "father-reunion", "Caleb se reúne a Sael e Ágata na plataforma sobre as nuvens.", "Os três foram levados até a plataforma", "gold"),
    (10, "second-chance", "Depois do retorno, Oliver e os cinco aliados enfrentam juntos a chegada de Harkan.", "Os cinco se posicionaram ao lado dele", "violet"),
    (11, "encirclement", "Nas ruínas, Oliver e os cinco aliados cercam Harkan com Caleb e Sael.", "De um lado, Oliver e os cinco fugitivos", "gold"),
    (11, "precise-ray", "Caleb concentra a energia do Coração em um raio que desestabiliza os artefatos.", "O raio atingiu Harkan", "violet"),
    (11, "prisoner", "Na cela antiga da base subterrânea, Harkan permanece acorrentado.", "Harkan estava desacordado", "cyan"),
    (12, "cibele-found", "Caleb encontra Cibele no prédio parcialmente destruído.", "Encontrou Cibele dentro de um prédio parcialmente destruído", "gold"),
    (12, "axel", "Com a faixa vermelha e os punhos energizados, Axel protege as ruas.", "Uma faixa vermelha presa ao braço", "rust"),
    (12, "refuge", "Lira cuida dos feridos no novo refúgio, onde os sobreviventes se ajudam.", "Lira ajudava alguns dos sobreviventes", "gold"),
]

PALETTES = {
    "violet": ("#090e22", "#32255a", "#be85ff", "#f3b36a"),
    "void": ("#060615", "#26234b", "#cf8bff", "#91dfff"),
    "rust": ("#171222", "#44343e", "#ef6f67", "#f5bc82"),
    "forest": ("#071c24", "#25454b", "#65d9c1", "#dbce8d"),
    "cyan": ("#0a1528", "#274460", "#85dbea", "#af93ff"),
    "gold": ("#182036", "#494653", "#efbf80", "#b7d9ee"),
}


class Drawing:
    def __init__(self, title, desc, palette, seed):
        self.dark, self.mid, self.light, self.warm = PALETTES[palette]
        self.p = []
        self.seed = seed
        self.title = title
        self.desc = desc

    def add(self, s):
        self.p.append(s)

    def path(self, d, fill="none", stroke=None, width=3, opacity=1):
        st = f' stroke="{stroke}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"' if stroke else ""
        self.add(f'<path d="{d}" fill="{fill}"{st} opacity="{opacity}"/>')

    def rect(self, x, y, w, h, fill, opacity=1, rx=0):
        self.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" opacity="{opacity}"/>')

    def circle(self, x, y, r, fill, opacity=1, stroke=None):
        st = f' stroke="{stroke}" stroke-width="3"' if stroke else ""
        self.add(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" opacity="{opacity}"{st}/>')

    def ellipse(self, x, y, rx, ry, fill, opacity=1, stroke=None):
        st = f' stroke="{stroke}" stroke-width="3"' if stroke else ""
        self.add(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{fill}" opacity="{opacity}"{st}/>')

    def glow(self, x, y, r, color=None):
        self.circle(x, y, r, "url(#halo)", .85)
        self.circle(x, y, r / 7, color or self.light, .8)

    def bolt(self, x1, y1, x2, y2, color=None, width=4):
        dx, dy = x2 - x1, y2 - y1
        d = f'M{x1},{y1} l{dx*.22},{dy*.28} l{-dy*.04},{dx*.07} l{dx*.36},{dy*.27} l{-dx*.09},{dy*.11} L{x2},{y2}'
        self.path(d, stroke=color or self.light, width=width+8, opacity=.1)
        self.path(d, stroke=color or self.light, width=width)
        self.path(d, stroke="#f5edff", width=max(1,width/3))

    def person(self, x, y, size=1, coat="#24303d", pose="stand", hair="#151928", accent=None):
        # Faces and clothes are a visual interpretation, with no additional lore.
        self.add(f'<g transform="translate({x} {y}) scale({size})">')
        self.ellipse(0, 7, 43, 9, "#050c17", .6)
        if pose == "kneel":
            self.path("M-17,-77 L-35,-32 -61,-18 -59,1 -8,0 4,-35 24,-25 42,0 60,0 39,-49 17,-80Z", "#111c2c")
            torso = "M-24,-137 Q0,-152 27,-133 L19,-68 -24,-70Z"
            arms = "M-24,-126 Q-49,-96 -29,-81 L-14,-94 M25,-128 Q52,-106 26,-88 L13,-93"
            head_y = -164
        elif pose == "run":
            self.path("M-11,-72 L-50,-27 -76,-19 -71,-6 -35,-8 4,-43 25,-48 53,-10 69,-15 38,-69Z", "#111c2c")
            torso = "M-19,-141 Q5,-157 32,-138 L15,-66 -14,-65Z"
            arms = "M-20,-132 L-48,-96 -70,-103 M30,-132 L53,-156 72,-145"
            head_y = -170
        elif pose == "seated":
            self.path("M-23,-61 L-24,-19 -45,-15 -43,0 -3,0 5,-42 26,-42 28,-8 61,-8 59,-22 43,-26 42,-66Z", "#111c2c")
            torso = "M-23,-132 Q0,-143 28,-127 L28,-59 -27,-59Z"
            arms = "M-24,-123 L-43,-81 -15,-64 M29,-120 L47,-83 19,-65"
            head_y = -158
        else:
            self.path("M-23,-80 L-27,-8 -41,-5 -42,4 -13,4 0,-54 11,1 39,1 37,-9 26,-12 23,-83Z", "#111c2c")
            torso = "M-24,-144 Q0,-155 27,-141 L24,-74 -27,-74Z"
            arms = {"cast":"M-24,-133 L-59,-118 -84,-127 M28,-133 L60,-150 91,-141", "reach":"M-24,-134 L-37,-87 -23,-69 M28,-131 L64,-142 99,-140", "guard":"M-25,-131 L-62,-115 -83,-81 M28,-131 L51,-101 77,-120"}.get(pose,"M-25,-134 L-40,-95 -33,-66 M28,-131 L43,-93 37,-66")
            head_y = -172
        self.path(torso, coat, stroke="#a6b4c9", width=1, opacity=.95)
        self.path(arms, stroke=coat, width=18)
        self.path(f'M-22,{head_y+20} Q0,{head_y+8} 22,{head_y+20} L17,{head_y+36} -17,{head_y+36}Z', coat)
        self.ellipse(0, head_y, 22, 27, "#b79587")
        self.path(f'M-22,{head_y-2} Q-29,{head_y-37} 1,{head_y-35} Q26,{head_y-35} 24,{head_y+4} L13,{head_y-13} -10,{head_y-19} -21,{head_y+7}Z',hair)
        self.path(f'M-11,{head_y+1} L-5,{head_y+2} M7,{head_y+2} L13,{head_y+1}',stroke="#172236",width=2)
        self.path(f'M-5,{head_y+14} L6,{head_y+14}',stroke="#685763",width=2)
        self.path(torso,fill="none",stroke="#d9e2ef",width=1,opacity=.18)
        if accent:
            self.path(f'M-17,-128 L18,-128',stroke=accent,width=5)
        self.add('</g>')

    def skyline(self):
        self.rect(0,0,1000,600,"url(#sky)")
        self.ellipse(550,85,440,95,self.mid,.7)
        for i in range(13):
            x = i * 85 - 25
            h = 125 + ((i * 47 + self.seed * 11) % 160)
            y = 405 - h
            self.path(f'M{x},{405} V{y+15} L{x+21},{y+15} {x+21},{y} {x+55},{y+8} {x+55},{y+23} {x+72},{y+23} V405Z', "#14213a",opacity=.85)
            for a in range(3):
                for b in range(4):
                    self.rect(x+13+a*17,y+40+b*24,6,11,self.light, .13 if (a+b+i)%3 else .45)
        self.path("M0,407 L180,396 340,409 502,380 700,396 1000,406 V600 H0Z", "#111725")
        self.path("M439,403 L230,600 M601,402 L805,600", stroke=self.mid,width=3)
        self.path("M0,501 L1000,519 M0,559 L1000,583",stroke="#8297b2",width=1,opacity=.22)
        for x,y,w in [(68,445,90),(827,420,106),(671,480,75)]:
            self.path(f'M{x},{y} l{w},-9 29,30 -9,23 -{w+20},-2Z',"#293443",stroke="#6c6d7d",width=1)
            self.rect(x+14,y-8,w-20,12,"#465264",.65)
        self.path("M170,440 L195,432 218,445 207,459 191,451Z", "#596171")

    def room(self, mode="bunker"):
        self.rect(0,0,1000,600,"url(#sky)")
        self.path("M0,0 H1000 L781,125 H230Z",self.mid)
        self.path("M0,600 L228,388 H786 L1000,600Z", "#17202e")
        self.path("M0,0 L228,125 V388 L0,600Z", "#1c293c")
        self.path("M1000,0 L786,125 V388 L1000,600Z", "#1a2738")
        self.rect(228,125,558,263,"#1b2434")
        for x in [260,340,660,746]:
            self.path(f'M{x},128 V385',stroke="#667187",width=2,opacity=.3)
        for y in [470,555]:
            self.path(f'M0,{y} H1000',stroke="#667187",width=1,opacity=.3)
        for x in [240,390,620,790]:
            self.path(f'M500,388 L{x},600',stroke="#667187",width=1,opacity=.22)
        if mode == "corridor":
            self.rect(405,166,186,223,"#070f20")
            for x in [250,327,675,750]:
                self.path(f'M{x},166 V366 M{x},166 h35 V366 h-35',stroke="#6684a2",width=3,opacity=.4)
            self.rect(460,131,80,7,self.warm,.6)
        else:
            self.rect(377,179,242,166,"#0e192a",rx=8)
            self.rect(392,192,212,134,"#163448",rx=4)
            for x in range(414,600,29):
                self.path(f'M{x},216 V298',stroke=self.light,width=1,opacity=.13)
            self.path("M405,270 L430,263 452,281 482,240 504,277 528,260 564,273 590,221",stroke=self.light,width=2,opacity=.7)
            self.rect(378,150,90,6,self.warm,.7)

    def forest(self, temple=False):
        self.rect(0,0,1000,600,"url(#sky)")
        self.circle(615,147,71,self.warm,.12)
        self.path("M0,380 Q190,283 370,385 Q570,269 780,373 Q935,298 1000,335 V600 H0Z", "#16313b")
        for i,x in enumerate([-26,75,179,835,929,1000]):
            y = 395 - i%2*25
            self.path(f'M{x-24},{y+130} L{x-12},60 {x+4},10 {x+17},100 {x+29},{y+130}Z', "#0e2530",stroke="#41605c",width=2)
            self.path(f'M{x+8},230 L{x-100},132 M{x},163 L{x+100},82',stroke="#112d34",width=13)
            self.ellipse(x,78,111,86,"#193c3e",.7)
        self.path("M250,600 Q465,401 551,327 L664,361 Q558,451 724,600Z", "#38494d",opacity=.7)
        if temple:
            self.path("M273,378 V160 L492,73 738,164 V380Z", "#273343",stroke="#688291",width=2)
            self.path("M393,378 V245 Q493,126 596,245 V378Z","#071824")
            for x in [300,337,654,699]:
                self.path(f'M{x},375 L{x+5},168 {x+27},163 {x+32},375Z',"#465162")
                self.path(f'M{x+4},226 l13,10 -8,29 19,11',stroke=self.light,width=2,opacity=.6)
            self.path("M282,160 L492,72 729,160",stroke="#98abb1",width=4)
            self.path("M441,383 L398,409 H606 L565,383", "#50606a")

    def mist(self, level=0):
        for i in range(4):
            y = 351 + 55*i - level
            self.path(f'M-20,{y} Q190,{y-57} 380,{y+10} T760,{y} T1040,{y+8} V{y+75} H-20Z',self.light,opacity=.04+.008*i)

    def pedestal(self, x=500, y=430, color=None):
        self.path(f'M{x-65},{y} L{x-52},{y-100} {x+50},{y-100} {x+67},{y}Z',"#101d2c",stroke="#748199",width=2)
        self.ellipse(x,y-100,61,19,"#465265",stroke=color or self.light)
        self.ellipse(x,y,75,15,"#080e1b",.6)

    def ring(self,x,y,r=43):
        self.ellipse(x,y,r,r*.82,"none",stroke="#e4d9df")
        self.ellipse(x,y,r-7,(r-7)*.82,"none",stroke=self.light)
        self.path(f'M{x-12},{y-r*.7} l12,-18 14,18 -14,15Z',self.light,stroke="#f9ecff",width=2)
        self.glow(x,y-r*.7,62)

    def fallen(self, positions=None):
        positions=positions or [(335,405),(665,403),(392,506),(576,520),(770,495)]
        for i,(x,y) in enumerate(positions):
            self.ellipse(x,y,48,10,"#040b14",.65)
            self.add(f'<g transform="translate({x} {y}) rotate({-11 if i%2 else 13})">')
            self.path("M-45,-15 L15,-20 36,-11 58,-13 64,-4 21,-4 -11,2 -46,-3Z",["#3d5364","#334d50","#49384f","#45404d","#375361"][i%5])
            self.circle(-51,-11,13,"#927e79")
            self.path("M-65,-12 Q-57,-36 -39,-22 L-44,-9Z","#152030")
            self.add('</g>')

    def rubble(self):
        for i in range(16):
            x=10+(i*67+self.seed*19)%985
            y=419+(i*31)%155
            self.path(f'M{x},{y} l22,-10 28,14 -15,18 -36,-6Z',"#4b5060",stroke="#717686",width=1,opacity=.8)

    def stars(self):
        for i in range(48):
            x=(i*139+self.seed*47)%997
            y=(i*73+self.seed*29)%470
            self.circle(x,y,1+(i%3)*.4,"#dfe6ff",.2+(i%4)*.1)

    def finish(self):
        self.add('<rect width="1000" height="600" fill="url(#grain)" opacity=".08"/><rect width="1000" height="600" fill="url(#vignette)"/>')
        head = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600" viewBox="0 0 1000 600" role="img" aria-labelledby="title desc">
<title id="title">{html.escape(self.title)}</title><desc id="desc">{html.escape(self.desc)}</desc>
<defs>
<linearGradient id="sky" x2=".7" y2="1"><stop stop-color="{self.dark}"/><stop offset=".58" stop-color="{self.mid}"/><stop offset="1" stop-color="{self.dark}"/></linearGradient>
<radialGradient id="halo"><stop stop-color="{self.light}" stop-opacity=".65"/><stop offset=".27" stop-color="{self.light}" stop-opacity=".18"/><stop offset="1" stop-color="{self.light}" stop-opacity="0"/></radialGradient>
<radialGradient id="vignette" r=".72"><stop offset=".35" stop-color="{self.dark}" stop-opacity="0"/><stop offset="1" stop-color="#030711" stop-opacity=".65"/></radialGradient>
<pattern id="grain" width="11" height="13" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".7" fill="#ffffff"/><circle cx="8" cy="9" r=".5" fill="#ffffff"/></pattern>
</defs>
'''
        return head+'\n'.join(self.p)+'\n</svg>\n'


def draw(d, kind):
    if kind in {"storm-city","first-lightning","street-circle","rescue","cibele-found","axel"}:
        d.skyline()
        if kind == "storm-city":
            for a in [(163,0,242,275),(567,0,475,335),(846,0,734,262)]: d.bolt(*a,width=5)
            d.glow(475,304,153)
            for i in range(38):
                x=(i*79)%1000; y=(i*43)%530
                d.path(f'M{x},{y} l-22,49',stroke="#b7c7ef",width=1,opacity=.3)
            d.path("M21,458 L180,443 M793,536 L977,552",stroke=d.light,width=4,opacity=.4)
        elif kind == "first-lightning":
            d.glow(506,355,245); d.person(515,503,1.04,pose="cast")
            d.bolt(508,-10,515,355,width=11)
            for end in [(345,441),(681,452),(470,575)]: d.bolt(515,355,*end,width=2)
            for rx,ry in [(118,30),(207,53)]: d.ellipse(516,507,rx,ry,"none",stroke=d.light)
        elif kind == "street-circle":
            d.person(514,504,1.08,pose="kneel")
            for rx,ry in [(104,25),(195,47),(323,82)]: d.ellipse(514,482,rx,ry,"none",stroke=d.light)
            d.glow(514,449,150)
            d.person(223,491,.63,pose="guard"); d.person(803,476,.67,pose="guard")
            for x,y in [(322,440),(690,451),(525,561)]: d.bolt(514,456,x,y,width=3)
        elif kind == "rescue":
            d.rubble(); d.person(433,508,1.04,pose="reach"); d.person(540,505,.9,coat="#664d57",pose="kneel")
            d.path("M473,459 L646,391 673,407 510,481Z","#667184",stroke="#c6ad99",width=3)
            d.bolt(535,368,630,411,color="#bd89ff",width=4)
            d.person(670,444,.8,pose="guard")
            d.path("M806,470 L786,322 849,279 897,328 948,371 927,419 881,355 865,391 877,478Z","#384550",stroke="#a18081",width=3)
            for x,y in [(824,338),(871,355),(900,396)]:d.rect(x,y,25,32,"#75808e",rx=3)
            d.circle(851,305,7,"#f08b84"); d.path("M791,320 Q750,264 762,228 M881,313 Q955,288 932,264",stroke="#738693",width=5)
        elif kind == "cibele-found":
            d.rubble(); d.path("M103,534 V101 L213,119 234,196 277,187 327,129 404,146 V536Z","#29394a",stroke="#758191",width=2)
            d.rect(209,255,151,216,"#101e2f");d.path("M109,169 L349,149 M126,351 L355,332",stroke="#9b8b77",width=6)
            d.person(477,524,1.12,pose="reach"); d.person(660,518,1.03,coat="#765763",pose="reach")
            d.glow(599,359,90);d.path("M256,180 L427,486",stroke="#657a88",width=13)
        else:
            d.rubble(); d.person(548,509,1.22,coat="#4c303a",pose="cast",accent="#f45d64")
            for x,y in [(548-84*1.22,509-127*1.22),(548+91*1.22,509-141*1.22)]:d.glow(x,y,87,"#f8736e")
            for x,y,s in [(201,483,.77),(774,485,.85),(840,424,.64)]:
                d.person(x,y,s,coat="#303442",pose="guard");d.path(f'M{x-36},{y-88} l55,-16 5,7 -40,19Z',"#a3a5ae")
    elif kind == "classroom":
        d.room(); d.rect(139,91,214,262,"#111c37",rx=2)
        d.rect(377,179,242,166,"#4b4a4e",rx=3)
        d.rect(386,188,224,148,"#293b3c",rx=1)
        d.path("M404,213 L458,218 M413,243 L485,231 M409,291 L502,289",stroke="#a1b0aa",width=2,opacity=.3)
        d.path("M141,91 L208,168 161,209 201,244 145,297 M285,92 L270,157 323,172 292,229 353,276",stroke="#8898c6",width=3)
        d.bolt(231,110,296,275,width=2)
        for x,y in [(53,460),(753,449),(805,495)]:
            d.path(f'M{x},{y} l108,0 17,24 -132,0Z',"#69585b",stroke="#9b9091",width=2)
            d.path(f'M{x+10},{y+24} v49 M{x+104},{y+24} v49',stroke="#606979",width=5)
        d.person(487,507,1.05,pose="guard");d.person(641,503,1.02,coat="#3c3347",pose="reach")
        for y in [367,389,435]:d.path(f'M438,{y} Q483,{y+8} 519,{y-3}',stroke=d.light,width=3)
        d.path("M574,369 L537,361",stroke="#bac6da",width=5);d.circle(538,361,4,d.warm)
        for x in [282,355,717,795,853]:d.person(x,423,.56,coat="#1c2739")
        d.mist(30)
    elif kind in {"void","ghost-touch","heart-split","throne-vision"}:
        d.rect(0,0,1000,600,"url(#sky)");d.stars()
        if kind == "void":
            d.glow(639,244,265);d.circle(639,244,58,d.light,.75);d.circle(633,233,19,"#f4dbff",.8)
            for r in [102,158,229]:d.ellipse(639,244,r,r*.6,"none",stroke=d.light)
            d.person(328,528,1.2,pose="reach");d.path("M0,553 Q537,445 1000,560",stroke=d.light,width=2,opacity=.2)
        elif kind == "ghost-touch":
            for i in range(45):
                x=28+(i*103)%968;y=55+(i*47)%418
                d.ellipse(x,y,9,13,d.light,.1);d.path(f'M{x-15},{y+29} Q{x},{y+12} {x+15},{y+29}',stroke=d.light,width=2,opacity=.13)
            d.glow(498,299,276);d.person(593,537,1.23,pose="guard");d.person(347,498,1.05,coat="#829fc5",hair="#cad8db",pose="reach")
            d.bolt(447,351,555,363,width=4)
            for a in [150,215,280,345]:d.path(f'M347,{a} l10,-7 5,13 -15,-6',stroke=d.light,width=2)
        elif kind == "heart-split":
            d.glow(484,249,271);d.glow(687,99,185)
            d.path("M487,299 C355,234 393,137 459,163 L512,235 524,294Z",d.light,stroke="#f5daff",width=4)
            d.path("M612,120 L570,58 Q661,-15 701,67 Q713,117 671,153Z",d.light,stroke="#f5daff",width=3)
            d.path("M528,264 Q594,148 635,101",stroke="#cdb2ff",width=3,opacity=.7)
            d.person(466,539,1.14,pose="cast");d.glow(466,395,74)
        else:
            d.path("M318,470 V141 L373,139 V85 L630,85 V141 L684,141 V470Z","#253345",stroke="#948fa8",width=3)
            d.path("M342,470 L319,532 H684 L661,470Z","#526072")
            d.person(499,466,1.17,coat="#30304c",pose="seated")
            for i in range(5):
                x=358+i*70;d.circle(x,166,21,"none",stroke=d.light);d.path(f'M{x},146 l-12,26 24,-10Z',stroke=d.light,width=2)
            d.glow(501,238,182);d.path("M0,561 Q460,439 1000,549",stroke=d.light,width=1,opacity=.3)
    elif kind == "healing-house":
        d.rect(0,0,1000,600,"url(#sky)")
        for x in range(0,1000,64):d.rect(x,0,61,432,"#514953",.55);d.path(f'M{x+18},0 V425',stroke="#aa8776",width=1,opacity=.4)
        d.rect(89,81,193,238,"#d6ad83",.9);d.rect(103,95,164,207,"#8eabb5")
        d.path("M90,82 L312,451 462,541 236,300Z",d.warm,opacity=.12)
        d.path("M127,94 V307 M245,94 V307",stroke="#403847",width=18)
        d.path("M307,441 L740,431 812,476 291,495Z","#d1b69d",stroke="#f4d5b4",width=3)
        d.path("M333,451 L456,435 627,443 657,467 501,480 375,482Z","#516886")
        d.ellipse(352,447,29,21,"#ad8e84");d.path("M319,446 Q325,414 365,426",stroke="#1c2a39",width=14)
        d.person(625,489,.86,coat="#5376a8",hair="#dac9a5",pose="seated")
        d.path("M517,459 L583,449",stroke="#efdfc7",width=13);d.path("M537,450 V467 M547,449 V466",stroke="#bbaa9a",width=2)
        d.person(835,498,.9,coat="#694b59")
        d.rect(66,395,116,56,"#675044");d.rect(67,451,10,78,"#322c34");d.circle(119,388,18,"#91b18c")
    elif kind in {"eron-forest","buried-machine","forest-run","forest-duel","bottle-training"}:
        d.forest();d.mist()
        if kind == "eron-forest":
            d.person(657,535,1.36,coat="#bebbb1",hair="#abb6bb");d.person(402,530,1.12,pose="cast");d.person(789,512,.77,coat="#597aa1",hair="#dfd0b3")
            d.glow(501,373,124,"#bd89ff");d.bolt(496,370,624,361,color="#bd89ff",width=4)
            d.path("M693,419 l-8,48 14,4 9,-48Z","#8ba69b",stroke="#c8cdac",width=2)
            d.path("M162,405 l112,-84 M103,454 l154,10",stroke="#4f8c72",width=3,opacity=.6)
        elif kind == "buried-machine":
            d.path("M419,484 L456,233 616,170 782,225 866,491Z","#233c44",stroke="#77858c",width=3)
            d.path("M506,459 V247 L677,225 774,275 V453Z","#091e2e",stroke="#77909a",width=3)
            for x in [531,607,712]:d.path(f'M{x},258 Q{x-25},330 {x+8},391 V459',stroke="#7096a2",width=6)
            for x,y in [(548,310),(702,334),(633,386)]:d.circle(x,y,8,"#ed7776");d.glow(x,y,39,"#ed7776")
            d.rect(668,424,96,28,"#8a948d",rx=3);d.path("M682,433 H751 M682,442 H729",stroke="#284348",width=3)
            d.person(326,534,1.14,coat="#b3b3aa",hair="#bfc4c7",pose="reach");d.rubble()
            d.path("M510,472 Q491,422 537,425 T599,466 M776,472 Q822,387 857,432",stroke="#466d59",width=7)
        elif kind == "forest-run":
            d.person(500,526,1.18,pose="run")
            for i in range(5):
                x=259+i*130;y=138+abs(2-i)*25;d.circle(x,y,28,"none",stroke=d.light);d.path(f'M{x-13},{y+7} l13,-22 13,22 -26,-5Z',stroke=d.light,width=2);d.glow(x,y,55)
            d.path("M339,427 Q379,378 423,357 M613,477 L675,485",stroke=d.light,width=3,opacity=.5)
        elif kind == "forest-duel":
            d.person(339,526,1.14,pose="cast");d.person(688,432,1.2,coat="#293042",pose="cast")
            d.path("M580,493 L627,415 659,491 693,441 736,500 774,458 797,508Z","#81bdde",stroke="#d0eafa",width=2)
            d.path("M784,275 Q755,263 785,224 Q774,243 801,229 Q827,268 798,288Z","#f4a066",stroke="#f5c896",width=2)
            for off in [0,35,75]:d.path(f'M548,{379+off} Q748,{209+off} 892,{342+off} Q1002,{443+off} 717,{466+off}',stroke=d.light,width=3,opacity=.5)
            d.bolt(442,361,598,337,color="#bd89ff",width=4)
        else:
            d.path("M0,430 L194,160 323,271 448,98 626,310 783,184 1000,430Z","#34485a",opacity=.65)
            d.person(310,532,1.12,pose="reach");d.person(515,505,1.06,coat="#a7a8a1",hair="#b4c1c6")
            d.path("M756,512 L760,386 844,386 865,512Z","#536174",stroke="#839598",width=3)
            d.path("M782,383 l4,-49 13,-1 4,49Z","#7bacab",stroke="#c2e3d9",width=2)
            d.path("M786,334 v-16 h10 v16",stroke="#9bcbc4",width=5)
            d.bolt(421,375,790,357,color="#bd89ff",width=3);d.glow(790,357,63,"#bd89ff")
    elif kind in {"ring-temple","ring-binding","crypt","conductor"}:
        d.rect(0,0,1000,600,"url(#sky)")
        d.path("M42,530 V130 L99,74 905,74 961,130 V530Z","#213140",stroke="#556a7c",width=3)
        d.path("M278,451 V181 Q499,4 721,181 V451Z","#091825",stroke="#566676",width=7)
        for x in [113,192,791,870]:
            d.rect(x,140,35,340,"#384a59");d.rect(x-13,125,60,22,"#63737e")
            for y in [184,237,302]:d.path(f'M{x+8},{y} l14,-8 5,14 -19,9Z',stroke=d.light,width=2,opacity=.55)
        d.path("M0,520 L1000,509 V600 H0Z","#182330");d.pedestal(510,470)
        d.mist()
        if kind == "ring-temple":
            d.person(295,537,1.11,pose="reach");d.ring(510,281,47)
            d.path("M431,351 Q646,332 547,258 Q449,199 538,162",stroke=d.light,width=4,opacity=.6)
        elif kind == "ring-binding":
            d.person(319,554,1.25,pose="kneel");d.ring(510,259,49)
            d.bolt(510,281,339,429,width=9);d.glow(346,429,151)
        elif kind == "crypt":
            d.ring(508,273,42)
            for off in [-56,0,56]:
                d.path(f'M{454+off},371 Q{392+off},275 {488+off},224 Q{551+off},189 {563+off},314',stroke="#c3d5e7",width=8,opacity=.75)
                for i in range(5):d.ellipse(460+off+i*11,248+i*19,9,14,"none",stroke="#8b9bb7")
            d.person(298,537,.96,coat="#3b485b",pose="kneel");d.person(705,527,.87,coat="#405366");d.person(813,551,.81,coat="#5c4c69")
            for x in [467,492,520,548]:d.path(f'M{x},374 l-8,32 17,-5',stroke="#bdbdb7",width=7)
        else:
            d.glow(511,271,181);d.circle(511,271,47,"#a4b97d",stroke="#e4d4a3");d.ellipse(511,270,20,44,"none",stroke="#385551")
            d.path("M464,271 H558 M480,238 L542,304 M478,304 L543,240",stroke="#eed693",width=3)
            d.person(701,527,1.09,coat="#2c4649",pose="reach");d.path("M240,533 L762,533",stroke=d.light,width=1,opacity=.3)
    elif kind == "shield":
        d.skyline();d.rubble();d.person(432,521,1.19,coat="#284955",pose="cast");d.person(661,508,1.07,coat="#193941",pose="guard")
        d.path("M484,180 L624,260 V421 L484,502 344,421 V260Z",d.light,stroke="#ceeff5",width=4,opacity=.19)
        d.path("M484,180 L624,260 V421 L484,502 344,421 V260Z",stroke=d.light,width=5)
        for x,y in [(330,186),(592,149),(688,240)]:d.ellipse(x,y,29,10,"#526d7c",stroke=d.light);d.glow(x,y,62)
        for y in [318,389]:d.bolt(170,y,356,y+20,width=3)
        d.circle(666,363,28,"#a8c281",stroke="#e5d5a0")
    elif kind in {"fusion","ghost-corridor","conductor-bunker","bunker-loss","grief","harkan-reveal","wall-battle","second-chance","prisoner","refuge"}:
        d.room("corridor" if kind in {"ghost-corridor","prisoner"} else "bunker")
        if kind == "fusion":
            for x,y,sz in [(303,365,.63),(710,371,.62),(840,495,.77)]:
                d.path(f'M{x-58},{y} l104,0 43,20 -151,0Z',"#6a7783",stroke="#a9b9bd",width=2)
                d.ellipse(x-30,y-5,13*sz,9*sz,"#afa298");d.path(f'M{x-14},{y-8} h57',stroke="#4a6575",width=13*sz)
                d.path(f'M{x},{y-6} Q{x-90},{y-100} {500},{130}',stroke=d.light,width=3,opacity=.65)
            d.person(501,555,1.2,coat="#726370",pose="seated",hair="#747f83")
            for x in [457,475,524,545]:d.path(f'M{x},380 Q{x-23},276 {x},182',stroke="#acbed0",width=3)
            d.rect(452,157,100,68,"#536271",rx=10);d.circle(501,190,20,"#dd6d78");d.glow(501,190,126,"#dd6d78")
        elif kind == "ghost-corridor":
            d.person(305,544,1.1,pose="guard");d.person(535,428,.98,coat="#729bc7",hair="#d2d6e5")
            d.glow(535,264,167);d.mist(90)
            for x,y in [(535,284),(520,322),(549,350),(534,388)]:d.path(f'M{x-5},{y} l9,-9 8,14 -12,7Z',stroke="#cff5f7",width=2)
            d.ellipse(535,424,71,12,d.light,.16)
        elif kind == "conductor-bunker":
            d.path("M325,405 L672,405 752,455 H260Z","#57617a",stroke="#8397ac",width=3)
            d.rect(349,455,15,98,"#374052");d.rect(661,455,15,98,"#374052")
            d.glow(501,363,160);d.circle(501,363,40,d.light,.85,stroke="#dcc2f2")
            d.path("M463,363 H541 M501,324 V400",stroke="#eff0fe",width=3)
            d.person(268,523,.98,pose="reach");d.person(731,512,.93,coat="#325b69",pose="reach")
            for x,y in [(354,419),(593,422),(659,430)]:d.path(f'M{x},{y} l46,-4 13,17 -53,2Z',"#d7c9b8")
        elif kind in {"bunker-loss","grief"}:
            d.fallen()
            if kind == "bunker-loss": d.person(486,555,1.24,pose="kneel")
            else:
                d.person(411,534,1.21,pose="kneel");d.person(775,396,.76,coat="#1a2132")
                d.glow(423,421,61)
            d.mist()
        elif kind == "harkan-reveal":
            d.person(334,557,1.28,pose="guard");d.person(658,544,1.5,coat="#272b42",pose="reach")
            d.circle(649,285,3,d.light);d.circle(672,285,3,d.light);d.glow(658,288,98)
            d.ring(431,406,15);d.ellipse(658,328,26,19,"#758faa",stroke=d.light)
            d.path("M619,478 Q696,521 789,451",stroke=d.light,width=3,opacity=.5)
        elif kind == "wall-battle":
            d.path("M642,126 L690,187 652,234 730,256 703,338 786,388",stroke="#080d19",width=17)
            d.person(341,539,1.26,pose="cast");d.person(684,468,1.23,coat="#262d40",pose="cast")
            d.bolt(456,363,577,330,color="#bd89ff",width=8);d.glow(579,330,194,"#bd89ff")
            for x,y in [(610,228),(725,206),(808,310),(793,374)]:d.path(f'M{x},{y} l28,-8 14,21 -34,12Z',"#7a7c90",stroke="#c0c1cb",width=2)
            d.fallen([(235,472),(744,540),(231,556),(860,496),(581,558)])
        elif kind == "second-chance":
            d.person(488,552,1.17,pose="guard");d.ring(568,412,16)
            for x,y,s,c in [(253,507,.81,"#315269"),(344,484,.79,"#304e59"),(617,504,.81,"#5b4762"),(712,526,1,"#48505d"),(808,491,.78,"#416377")]:d.person(x,y,s,coat=c,pose="guard")
            d.person(500,340,.78,coat="#202539",pose="cast")
            d.glow(500,188,114);d.path("M420,175 H575",stroke=d.light,width=2,opacity=.5)
        elif kind == "prisoner":
            d.person(503,426,1.03,coat="#363343",pose="seated")
            d.path("M458,310 Q434,382 511,380 Q570,383 541,305",stroke="#b4c8d1",width=5)
            for x in range(374,633,35):d.rect(x,109,9,347,"#728695")
            d.path("M369,169 H637 M369,407 H637",stroke="#93a9b5",width=12)
            d.person(786,552,1.26,coat="#4c596a");d.person(196,513,1.08)
            d.glow(503,305,96)
        else:
            d.rect(376,185,252,145,"#665947",.55,rx=10)
            d.path("M306,422 L629,422 681,455 H281Z","#a08f7a",stroke="#d8c9aa",width=2)
            d.ellipse(344,432,22,15,"#b39984");d.path("M369,430 H527",stroke="#6d8090",width=28)
            d.person(564,486,.94,coat="#6380a4",hair="#d8caa9",pose="reach");d.glow(479,356,146,"#b9e5d0")
            d.person(169,530,.91,coat="#796368");d.person(238,522,.53,coat="#667a91");d.person(756,515,1.01,coat="#64727c",pose="seated");d.person(884,493,.82,coat="#6e5463")
            d.rect(776,420,126,13,"#846e5b");d.circle(823,411,13,"#c7b081");d.circle(857,411,13,"#bb997c")
            for x in [282,691]:d.path(f'M{x},380 V269',stroke="#604631",width=6);d.path(f'M{x-12},283 Q{x-15},250 {x},237 Q{x+24},260 {x+12},284Z',"#efb776");d.glow(x,263,62,"#efb776")
    elif kind in {"cloud-platform","father-reunion"}:
        d.rect(0,0,1000,600,"url(#sky)");d.stars()
        for i in range(6):
            x=-80+i*225;y=440+i%2*45
            d.ellipse(x,y,186,63,"#91adbf",.27);d.ellipse(x+89,y-26,138,59,"#b0c3d1",.21)
        d.path("M161,430 L402,331 724,342 874,455 555,524Z","#687589",stroke="#a6b6cc",width=3)
        d.path("M161,430 L192,460 555,554 874,482 874,455 555,524Z","#2c405b",stroke="#60768d",width=2)
        d.person(404,453,1.08,coat="#4b5971");d.person(676,465,1.02,coat="#615274",hair="#bbc9d3")
        if kind == "cloud-platform":
            d.glow(537,250,195);d.path("M521,298 Q451,231 520,190 L562,254Z",d.light,stroke="#efe3ff",width=3)
        else:
            d.person(544,484,1.08,pose="reach");d.glow(544,333,58);d.path("M0,108 Q402,29 996,117",stroke=d.warm,width=2,opacity=.4)
    elif kind in {"encirclement","precise-ray"}:
        d.skyline();d.rubble()
        d.path("M122,429 V261 L174,202 242,211 V420 M761,415 V208 L831,168 872,236 V426",stroke="#637485",width=22)
        if kind == "encirclement":
            d.person(531,420,.9,coat="#262d42",pose="guard")
            for x,y,s,c in [(158,503,.77,"#40576d"),(247,489,.72,"#375662"),(354,521,.83,"#605271"),(778,522,.94,"#515869"),(866,503,.74,"#416475")]:d.person(x,y,s,coat=c,pose="guard")
            d.person(448,563,1.08,pose="cast");d.person(680,559,1.14,coat="#506174",pose="guard")
            for x,y,r in [(441,309,49),(538,287,62),(628,311,45)]:d.ellipse(x,y,r,r*.75,"none",stroke=d.light)
            d.path("M208,420 L258,374 298,389 330,428",stroke="#a5b39f",width=14,opacity=.5)
        else:
            d.person(246,543,1.21,pose="reach");d.person(766,511,1.13,coat="#343042",pose="kneel")
            d.bolt(366,374,766,349,width=8);d.glow(766,349,166)
            for x,y in [(720,279),(811,291),(700,387),(840,385)]:d.path(f'M{x},{y} l13,-17 18,21 -8,13Z',"#909abc",stroke=d.light,width=2)
            d.person(488,513,.83,pose="guard");d.path("M476,376 L507,288",stroke="#dae3ee",width=6)
            d.glow(246,370,99)
    else:
        raise ValueError(f"Unknown scene: {kind}")


def main():
    source = ASSETS / "chapters.json"
    original = source.read_bytes()
    chapters = {c["number"]: c for c in json.loads(original)["chapters"]}
    manifest = {}
    DEST.mkdir(parents=True, exist_ok=True)
    totalsize = 0
    for n, kind, caption, quote, palette in SCENES:
        chapter = chapters[n]
        if quote not in chapter["text"]:
            raise ValueError(f"Scene {n}/{kind} is not supported by the source: {quote}")
        pages = chapter["pages"]
        matches = [index for index,page in enumerate(pages) if quote in page]
        if not matches:
            raise ValueError(f"Scene {n}/{kind} quote crosses pages; use a shorter exact excerpt")
        page = matches[0]
        scene_number = len(manifest.setdefault(n, [])) + 1
        filename = f"chapter-{n}-{scene_number}.svg"
        desc = f"Ilustração vetorial original da cena do capítulo {n}, página {page+1}. {caption} Trecho de referência: {quote}. Cores e composição são interpretação artística do texto recuperado."
        drawing = Drawing(f"Capítulo {n} — {chapter['title']}: cena {scene_number}", desc, palette, n*17+scene_number)
        draw(drawing, kind)
        svg = drawing.finish()
        ET.fromstring(svg)
        if "http://" in svg.replace('http://www.w3.org/2000/svg', '') or "https://" in svg or '<script' in svg or '<image' in svg:
            raise ValueError("Illustrations must have no external assets or executable SVG content")
        (DEST / filename).write_text(svg, encoding="utf-8")
        totalsize += len(svg.encode("utf-8"))
        manifest[n].append({"src":f"scenes/illustrated/{filename}", "caption":caption, "alt":caption, "page":page, "quote":quote, "sourceOffset":chapter["text"].index(quote)})
    assert len(manifest) == 12 and all(len(scenes) == 3 for scenes in manifest.values())
    text = "/* Original local illustrations, generated from verified chapter excerpts. */\nwindow.SinapseChapterScenes = " + json.dumps(manifest, ensure_ascii=False, indent=2) + ";\n"
    (ASSETS / "chapter-scenes.js").write_text(text, encoding="utf-8")
    assert source.read_bytes() == original, "Recovered narrative was modified"
    print(f"Verified {sum(map(len,manifest.values()))} SVG illustrations; {totalsize:,} bytes total.")
    print(f"chapters.json preserved: SHA-256 {hashlib.sha256(original).hexdigest()}")


if __name__ == "__main__":
    main()
