const VOCABULARY = [
    { id: 'apple', word: 'Apple', icon: 'apple', color: '#ef4444' },
    { id: 'car', word: 'Car', icon: 'car', color: '#3b82f6' },
    { id: 'dog', word: 'Dog', icon: 'dog', color: '#b45309' },
    { id: 'cat', word: 'Cat', icon: 'cat', color: '#fb923c' },
    { id: 'sun', word: 'Sun', icon: 'sun', color: '#facc15' },
    { id: 'moon', word: 'Moon', icon: 'moon', color: '#94a3b8' },
    { id: 'star', word: 'Star', icon: 'star', color: '#eab308' },
    { id: 'cloud', word: 'Cloud', icon: 'cloud', color: '#93c5fd' },
    { id: 'fish', word: 'Fish', icon: 'fish', color: '#06b6d4' },
    { id: 'bird', word: 'Bird', icon: 'bird', color: '#0ea5e9' },
    { id: 'house', word: 'House', icon: 'house', color: '#059669' },
    { id: 'bed', word: 'Bed', icon: 'bed', color: '#818cf8' },
    { id: 'book', word: 'Book', icon: 'book', color: '#f43f5e' },
    { id: 'phone', word: 'Phone', icon: 'phone', color: '#a855f7' },
    { id: 'plane', word: 'Plane', icon: 'plane', color: '#2563eb' },
    { id: 'boat', word: 'Boat', icon: 'ship', color: '#14b8a6' },
    { id: 'hammer', word: 'Hammer', icon: 'hammer', color: '#6b7280' },
    { id: 'flower', word: 'Flower', icon: 'flower-2', color: '#ec4899' },
    { id: 'tree', word: 'Tree', icon: 'tree-deciduous', color: '#16a34a' },
    { id: 'ghost', word: 'Ghost', icon: 'ghost', color: '#a5b4fc' },
    { id: 'rocket', word: 'Rocket', icon: 'rocket', color: '#ef4444' },
    { id: 'umbrella', word: 'Umbrella', icon: 'umbrella', color: '#ec4899' },
    { id: 'robot', word: 'Robot', icon: 'bot', color: '#94a3b8' },
    { id: 'truck', word: 'Truck', icon: 'truck', color: '#f59e0b' },
    { id: 'gift', word: 'Gift', icon: 'gift', color: '#10b981' },
    { id: 'heart', word: 'Heart', icon: 'heart', color: '#f43f5e' },
    { id: 'bus', word: 'Bus', icon: 'bus', color: '#facc15' },
    { id: 'pencil', word: 'Pencil', icon: 'pencil', color: '#3b82f6' },
    { id: 'pizza', word: 'Pizza', icon: 'pizza', color: '#ea580c' },
    { id: 'cake', word: 'Cake', icon: 'cake', color: '#f472b6' },
    { id: 'bell', word: 'Bell', icon: 'bell', color: '#eab308' },
    { id: 'key', word: 'Key', icon: 'key', color: '#94a3b8' },
    { id: 'music', word: 'Music', icon: 'music', color: '#8b5cf6' },
    { id: 'map', word: 'Map', icon: 'map', color: '#6366f1' },
    { id: 'camera', word: 'Camera', icon: 'camera', color: '#64748b' },
    { id: 'watch', word: 'Watch', icon: 'watch', color: '#475569' },
    { id: 'battery', word: 'Battery', icon: 'battery', color: '#22c55e' },
    { id: 'anchor', word: 'Anchor', icon: 'anchor', color: '#1e40af' },
    { id: 'cookie', word: 'Cookie', icon: 'cookie', color: '#b45309' },
    { id: 'ice-cream', word: 'Ice Cream', icon: 'ice-cream-bowl', color: '#fb7185' },
    { id: 'bicycle', word: 'Bicycle', icon: 'bike', color: '#3b82f6' },
    { id: 'sunflower', word: 'Sunflower', icon: 'sun', color: '#fbbf24' },
    { id: 'earth', word: 'Earth', icon: 'earth', color: '#10b981' },
    { id: 'lightbulb', word: 'Light', icon: 'lightbulb', color: '#facc15' },
    { id: 'mountain', word: 'Mountain', icon: 'mountain', color: '#64748b' },
    { id: 'palette', word: 'Paint', icon: 'palette', color: '#ec4899' },
];

const STATIC_STORIES = {
    'apple': [
        "A little red apple fell from a tree. Bonk! It rolled all the way to a hungry horse.",
        "One day an apple wanted to fly. A bird picked it up, but it was too heavy!"
    ],
    'car': [
        "Beep beep! The blue car raced down the hill. It was faster than the wind!",
        "The little car was tired. It went into the garage to sleep. Goodnight, car."
    ],
    'dog': [
        "Woof! The fluffy dog chased its own tail. Round and round it went!",
        "The dog found a big stick. It was so happy, it wagged its tail fast!"
    ],
    'cat': [
        "Meow! The sleepy cat curled up in the sun. It purred softly.",
        "The cat saw a butterfly. It tried to catch it, but the butterfly was too quick!"
    ],
    'sun': [
        "Mr. Sun woke up early. He stretched his warm rays and said hello to the world!",
        "The sun played peek-a-boo with the clouds. Now you see him, now you don't!"
    ],
    'moon': [
        "The moon watched over the sleeping town. It shone like a silver coin.",
        "Goodnight Moon! It smiled down at all the sleepy animals."
    ],
    'star': [
        "Twinkle, twinkle! A little star wanted to visit Earth. It jumped down as a shooting star!",
        "The star was lonely, so it called its friends. Soon the sky was full of light."
    ],
    'fish': [
        "Splish splash! The little fish swam in the deep blue sea. It blew tiny bubbles.",
        "The fish met a crab. They played tag in the coral reef. You're it!"
    ],
    'bird': [
        "Chirp chirp! The bird built a cozy nest. It sang a happy song for its babies.",
        "The bird flew high in the sky. Look at its blue wings flap!"
    ],
    'ice-cream': [
        "Yum! A big scoop of ice cream on a hot day. Don't let it melt!",
        "The ice cream was cold and sweet. It made everyone smile."
    ],
    'house': [
        "Knock knock! Who is in the little house? A bunny opened the door.",
        "The house had a red roof and a big chimney. Smoke puffed out like a cloud."
    ],
    'bed': [
        "The soft bed was ready for sleep. It had a fluffy pillow and a warm blanket.",
        "Jump, jump! The little monkey jumped on the bed until he fell asleep."
    ],
    'book': [
        "Open the book and see the magic! Dragons and fairies flew out of the pages.",
        "The book was full of colorful pictures. Each page told a fun new story."
    ],
    'phone': [
        "Ring ring! The phone is ringing. Hello? Is it grandma calling?",
        "The baby played with the phone. Beep boop beep! Making music is fun."
    ],
    'plane': [
        "Zoom! The big plane flew over the clouds. The people below looked like ants.",
        "The plane landed on the runway with a squeak. Welcome home, travelers!"
    ],
    'boat': [
        "The boat bobbed on the waves. Up and down, up and down. Careful not to splash!",
        "A little sailor steered the boat. He saw a dolphin jumping in the water."
    ],
    'flower': [
        "The flower opened its petals to the sun. A bee came to say hello. Bzzzz!",
        "A beautiful flower grew in the garden. It smelled so sweet, like perfume."
    ],
    'tree': [
        "The big tree had strong branches. A squirrel climbed up to hide a nut.",
        "In the autumn, the tree dropped its leaves. Red, yellow, and orange confetti!"
    ],
    'ghost': [
        "Boo! The little ghost tried to be scary, but he was just too cute.",
        "The ghost floated through the wall. He was looking for a tasty treat."
    ],
    'rocket': [
        "3, 2, 1, Blast off! The rocket shot into space. It visited the moon and stars.",
        "The astronaut looked out the rocket window. Earth looked like a blue marble."
    ],
    'robot': [
        "Beep boop! The robot did a funny dance. His metal arms went clank, clank.",
        "The robot helped clean the room. He picked up all the toys with his gripper."
    ],
    'pizza': [
        "Hot cheesy pizza! Yummy pepperoni and mushrooms. Cut me a big slice, please!",
        "The pizza chef spun the dough in the air. Round and round it went like a wheel."
    ],
    'cake': [
        "Happy birthday! The cake had three candles. Make a wish and blow them out.",
        "Chocolate cake with sprinkles on top. It was the best dessert ever."
    ],
    'cookie': [
        "Crunch, crunch! The cookie had chocolate chips inside. Don't get crumbs on the floor!",
        "Grandma baked fresh cookies. The whole house smelled like warm sugar."
    ],
    'bicycle': [
        "Ring ring! The bicycle bell rang. Pedaling fast is so much fun!",
        "The bicycle had two wheels and a shiny red frame. Let's go for a ride in the park."
    ],
    'hammer': [
        "Bang bang! The hammer hit the nail. We are building a treehouse.",
        "The builder used a heavy hammer. It made a loud noise. Clang!"
    ],
    'umbrella': [
        "It started to rain. Drip, drop! The umbrella popped open to keep us dry.",
        "The colorful umbrella looked like a mushroom. We splashed in the puddles."
    ],
    'truck': [
        "Honk honk! The big truck carried heavy rocks. Its wheels were huge!",
        "The garbage truck came to pick up the trash. It made a loud crunching sound."
    ],
    'gift': [
        "Surprise! The gift was wrapped in shiny paper. What could be inside?",
        "I gave my friend a gift. She smiled and said thank you. It was a teddy bear!"
    ],
    'heart': [
        "Thump thump. Can you feel your heart beat? It means you are alive and happy.",
        "I love you with all my heart. It is full of love and kindness."
    ],
    'bus': [
        "The wheels on the bus go round and round. All through the town!",
        "We rode the yellow school bus. Everyone sat in their seats and waved."
    ],
    'pencil': [
        "Scratch, scratch. The pencil drew a picture on the paper. It was a funny cat.",
        "I sharpened my pencil. Now it has a pointy tip ready to write a story."
    ],
    'bell': [
        "Ding dong! The bell rang at the door. Who is coming to visit?",
        "The little cat wore a bell on its collar. Jingle, jingle, everywhere it walked."
    ],
    'key': [
        "Click clack. The key turned in the lock. The door opened wide!",
        "I found a shiny gold key. Maybe it opens a secret treasure chest."
    ],
    'music': [
        "La la la! We sang a song together. Music makes us want to dance.",
        "The piano played beautiful music. Plink, plonk. Everyone clapped their hands."
    ],
    'map': [
        "We looked at the map. It showed us the way to the hidden treasure.",
        "The map had X marks the spot. We followed the dotted line through the forest."
    ],
    'camera': [
        "Say cheese! Click! The camera took a photo. Now we can keep this memory forever.",
        "My dad has a big camera. He takes pictures of birds and flowers."
    ],
    'watch': [
        "Tick tock. The watch on my wrist tells the time. Is it lunch time yet?",
        "My grandpa has a gold watch. He listens to it tick. It is very old."
    ],
    'battery': [
        "The toy stopped working. Oh no! It needs a new battery to go zoom again.",
        "Batteries give power to our toys. Plus and minus, put them in the right way."
    ],
    'anchor': [
        "Splash! The heavy anchor fell into the water. It held the boat in one place.",
        "The pirate ship dropped its anchor. It was made of strong iron."
    ],
    'sunflower': [
        "The tall sunflower looked at the sun. It was yellow and had big green leaves.",
        "Bees love the sunflower. They land on it to get yummy nectar."
    ],
    'earth': [
        "We live on planet Earth. It is a big blue ball floating in space.",
        "Love our Earth! Keep the oceans clean and plant more trees."
    ],
    'lightbulb': [
        "Click! The lightbulb turned on. Now we can see in the dark room.",
        "The idea was so good, it was like a lightbulb turned on above his head!"
    ],
    'mountain': [
        "The mountain was very high. It touched the clouds. We climbed to the top!",
        "There was snow on top of the mountain. It looked like white icing on a cake."
    ],
    'palette': [
        "The artist used a palette to mix colors. Red and blue made purple!",
        "My palette has every color of the rainbow. I will paint a beautiful sunset."
    ]
};

const GENERIC_STORY_TEMPLATES = [
    "Once there was a friendly {word}. It loved to play with its friends all day long.",
    "Look at the {word}! It is so happy today. It wants to give you a big hug.",
    "The {word} went on a fun adventure. It saw many amazing things!",
    "One day, a {word} started to dance. Wiggle, wiggle, wiggle! What a funny dance.",
    "The little {word} is very sleepy. Shhh, let's let it take a nice nap.",
    "Wow! The {word} is very special. Can you say hello to the {word}?",
    "The {word} found a magical balloon. Up, up, up it went into the sky!",
    "Do you see the {word}? It is hiding. Peek-a-boo! I see you!"
];

const STATIC_HINTS = {
    'apple': ["It is red and crunchy!", "It grows on a tree."],
    'car': ["Beep beep! It has four wheels.", "You ride in it to go places."],
    'dog': ["Woof woof! It loves to play fetch.", "A furry friend with a wagging tail."],
    'cat': ["Meow! It has soft fur and whiskers.", "It likes to chase mice."],
    'sun': ["It is hot and yellow in the sky.", "It comes out in the daytime."],
    'moon': ["You see it at night.", "It shines in the dark sky."],
    'fish': ["It swims in the water.", "Blub blub! It has fins."],
    'bird': ["It can fly high in the sky.", "Chirp chirp! It has wings."],
    'ice-cream': ["It is cold and sweet.", "Yum! You eat it in a cone."]
};

const GENERIC_HINT_TEMPLATES = [
    "Can you find the {word}?",
    "Where is the {word} hiding?",
    "Look for something that is {color}!",
    "It is a fun thing! Can you spot it?",
    "Find the picture of the {word}."
];
