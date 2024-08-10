import appLogo from '/logo.svg'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"


import { createBrowserRouter, Link, redirect, RouterProvider, useLoaderData } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useState } from 'react'
import { Table, TableBody, TableCell, TableRow } from './components/ui/table'


type Account = {
  name: string;
}

type HomePagePageProps = {
  account: Account
};

const transactions = [
  { lastUpdated: "2 min ago", name: "Bob Dylan", amount: "$250.00" ,status: "Paid"},
  { lastUpdated: "1h ago", name: "Restaurant La Fourchette", amount: "$50.00" ,status: "Paid"},
  { lastUpdated: "Monday", name: "NetFlix", amount: "$19.00" ,status: "Paid"},
  { lastUpdated: "Sunday", name: "Alice", amount: "$20.00" ,status: "Paid"},
];


export const HomePage = () => {
  const account = useLoaderData() as Account;
  return (
      <Card>
      <CardContent style={{textAlign:"left"}}> 
          <img src={appLogo} alt="cardano-lightning-demo logo" className="h-24 inline p-6 transition duration-300 filter hover:drop-shadow-lg" />
        <div>
        <b>Account</b> : {account.name} 
      </div>
      <div> 
      <b>Balance</b> : 0 ADA
        <Button size="sm" style={{margin:"5px"}}>+</Button>
        <Button size="sm" style={{margin:"5px"}}>-</Button>
      </div>
      <div>
        <b>Transactions</b>
        <Table>
          <TableBody>
            {transactions.map((transaction) => (
            <TableRow>
              <TableCell className="font-medium">{transaction.name}</TableCell>
              <TableCell className="font-small">{transaction.lastUpdated}</TableCell>
              <TableCell>{transaction.status}</TableCell>
              <TableCell className="text-right">{transaction.amount}</TableCell>
            </TableRow>
            ))}
          </TableBody>
        </Table> 
        <Button style={{margin:"5px"}}>Pay</Button>
        <Button style={{margin:"5px"}}>Bill</Button>
      </div>
      </CardContent>
      <CardFooter>
      </CardFooter>
    </Card>
  )
}

// Lets quickly create some stubs for the components above
const Login = () => {
  return (
    <div>
      <h1>Login</h1>
      <Link to="/Login/Create">Create Account</Link>
      <Link to="/Login/Restore">Restore Account</Link>
    </div>
  )
};

// export interface FromBip39MnemonicWordsProps {
//   chainId: Cardano.ChainId;
//   mnemonicWords: string[];
//   mnemonic2ndFactorPassphrase?: string;
//   getPassphrase: GetPassphrase;
//   accountIndex?: number;
//   purpose?: KeyPurpose;
// }


//  {
//    chainId,
//    getPassphrase,
//    mnemonicWords,
//    mnemonic2ndFactorPassphrase = '',
//    accountIndex = 0,
//    purpose = KeyPurpose.STANDARD
//  }: FromBip39MnemonicWordsProps,
//
//
//
//
const mnemonicWordsValidator = z.string().transform((value) => {
  return { transformed: value.trim().split(/\s+/g), orig: value };
}).refine((words) => {
    return [12, 15, 24].includes(words.transformed.length);
  },
  { message: "Mnemonic must contain exactly 12, 15, or 24 words."
});

const keyManagerValidator = mnemonicWordsValidator.transform(async ({ transformed, orig } : { transformed: string[], orig: string }): Promise<{ transformed: InMemoryKeyAgent, orig: string } | null> => {
  const keyAgentDependencies = {
    bip32Ed25519: new SodiumBip32Ed25519(),
    logger: dummyLogger
  };

  const bip32Props:FromBip39MnemonicWordsProps = {
    chainId: Cardano.ChainIds.Mainnet,
    mnemonicWords: transformed,
    getPassphrase: (_) => new Promise(() => [])
  };
  try {
    let km = await InMemoryKeyAgent.fromBip39MnemonicWords(bip32Props, keyAgentDependencies);
    return { transformed: km, orig };
  } catch (error) {
    return null;
  }
}).refine((keyAgent) => {
    return keyAgent !== null;
  },
  { message: "Invalid mnemonic." }
);

const formSchema = z.object({
  mnemonic: keyManagerValidator,
});

type LoginFormProps = {
  onLogin: (keyManager: InMemoryKeyAgent) => void
};


export const RestoreAccountForm : React.FC<LoginFormProps> = ({onLogin}) => {
  // 1. Define your form.
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema, {}, { mode: 'async' }),
  });

  // 2. Define a submit handler.
  function onSubmit(values: z.infer<typeof formSchema>) {
    // Do something with the form values.
    // ✅ This will be type-safe and validated.
    console.log(values)
    // localStorage.setItem('accountNameRegistered', values.accountName);
    onLogin(values.mnemonic.transformed);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="mnemonic"
          render={({ field }) => {
            return (
              <FormItem>
                <FormLabel>Account Name</FormLabel>
                <FormControl>
                  <Input placeholder="Your Account Name" value={field.value.orig} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
          )}}
        />
        <Button type="submit">Create</Button>
      </form>
    </Form>
  )
}

const Restore = () => {
  // const [mnemonicError, setMnemonicError] = useState<string | null>(null);
  const onLogin = (keyManager: InMemoryKeyAgent) => {
    console.log("Login with keyManager", keyManager);
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome To The Cardano Ligntning Network</CardTitle>
        <CardDescription className='place-content-center'>
          <img src={appLogo} className="logo" alt="cardano-lightning-demo logo" />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RestoreAccountForm onLogin={onLogin} />
      </CardContent>
      <CardFooter>
      </CardFooter>
    </Card>
  );
}
const Create = () => <div>Create</div>

const router = createBrowserRouter([
  {
    loader: () => {
      // let's for now check local storage
      const accountNameRegistered = localStorage.getItem('session');
      if (accountNameRegistered) {
        return { account: { name: accountNameRegistered } };
      }
      return redirect("/Login");
    },
    path: "/",
    element: <HomePage />
  },
  { path: "/Login"
  , element: <Login/>
  },
  { path: "/Login/Restore"
  , element: <Restore/>
  },
  { path: "/Login/Create"
  , element: <Create/>
  },
]);


function App() {
  const [accountNameRegistered, setAccountNameRegistered] = useState<Account>();
  // const isConnected = ((accountNameRegistered === null || accountNameRegistered === undefined) ? false : true ); 

  return (
    <div className="max-w-7xl mx-auto p-4 text-center">
      <RouterProvider router={router} />
    </div>
  );
}

// type CreateAccountPageProps = {
//   onRegistered: (account:Account) => void 
// };
// 
// export const CreateAccountPage : React.FC<CreateAccountPageProps> = ({onRegistered}) => {
//   return (
//     <Card>
//       <CardHeader>
//         <CardTitle>Welcome To The Cardano Ligntning Network</CardTitle>
//         <CardDescription className='place-content-center'>
//           <img src={appLogo} className="logo" alt="cardano-lightning-demo logo" />
//         </CardDescription>
//       </CardHeader>
//       <CardContent>
//         <CreateAccountForm onRegistered={onRegistered} />
//       </CardContent>
//       <CardFooter>
//       </CardFooter>
//     </Card>
//   )
// }
// 
// const formSchema = z.object({
//   accountName: z.string().min(2, {
//     message: "Account Name must be at least 2 characters.",
//   }),
// })
// 
// 
// 
// export const CreateAccountForm : React.FC<CreateAccountFormProps> = ({onRegistered}) => {
//   // 1. Define your form.
//   const form = useForm<z.infer<typeof formSchema>>({
//     resolver: zodResolver(formSchema),
//     defaultValues: {
//       accountName: "",
//     },
//   })
// 
//   // 2. Define a submit handler.
//   function onSubmit(values: z.infer<typeof formSchema>) {
//     // Do something with the form values.
//     // ✅ This will be type-safe and validated.
//     console.log(values)
//     localStorage.setItem('accountNameRegistered', values.accountName);
//     onRegistered({name:values.accountName});
//   }
// 
//   return (
//     <Form {...form}>
//       <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
//         <FormField
//           control={form.control}
//           name="accountName"
//           render={({ field }) => (
//             <FormItem>
//               <FormLabel>Account Name</FormLabel>
//               <FormControl>
//                 <Input placeholder="Your Account Name" {...field} />
//               </FormControl>
//               <FormMessage />
//             </FormItem>
//           )}
//         />
//         <Button type="submit">Create</Button>
//       </form>
//     </Form>
//   )
// }
// 
// 
export default App;

 
