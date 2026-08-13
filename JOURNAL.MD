so in fastify, i am writing a script, telling it to run from top to bottom and tracing it, in nest, nothing runs from top to bottom, I write a pile of classes and some metadata on how they relate and then i hand it over to NestFactory.create method. it reads the classes and the metadata description, works out the order and builds the application.
to read a Nest codebase, start at the .module.ts file not at main.ts. The modules
A class has a constructor and a constuctor is a standard machine readable place to say "here is what i need in order to work."

@Injectable i think it s saying that this class supports dependency innjection, meaning it can imprt things needed to work.
export class CartService {
    constructor(private prisma :  PrismaService, private sanity: SanityService,){}
}
okay so what the above class is saying in English is that CartService is a thing that can be built and to build one you must give it a prisma and a sanity service. true tru cause to get a card, you you have to write to the orm and then get products from sanity okayy. 

Nest occurs at boot time? instanciates every provider once!
so every request that is coming is going through already loaded objects, hmm so what each user need has been loaded already. it ns not lazy loaded

providers, services are machines, the saw, the lathe, the sander, installed once when the workshop opnes. we dont build a new saw per oder.
A module is a department. the painting room has some machines and it decides which it will lend out via exports and which one it will need to borrwo(whether electricity generator via imports)
controllers are the front counter. they take the order and hand it back and forth, they do not work
requests are orders going through processes that already exist
nestFactory.create() is opening day