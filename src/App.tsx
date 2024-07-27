import appLogo from '/favicon.svg'
import './App.css'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"


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
import { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableRow } from './components/ui/table'


type Account = {
  name: string;
}

function App() {
  const [accountNameRegistered, setAccountNameRegistered] = useState<Account>();
  const isConnected = ((accountNameRegistered === null || accountNameRegistered === undefined) ? false : true ); 

  console.log(accountNameRegistered)
  console.log(isConnected)
  useEffect(() => {
    const accountNameRegistered = localStorage.getItem('accountNameRegistered');
    if (accountNameRegistered) {
      setAccountNameRegistered({name: accountNameRegistered});
    }
    
  }, []);

  return (accountNameRegistered ? <HomePage account={accountNameRegistered} /> : <CreateAccountPage onRegistered={(account:Account) => setAccountNameRegistered(account) }/> )
}

type HomePagePageProps = {
  account: Account
};

const transactions = [
  {lastUpdated: "2 min ago", name: "Bob Dylan", amount: "$250.00" ,status: "Paid"}
, {lastUpdated: "1h ago", name: "Restaurant La Fourchette", amount: "$50.00" ,status: "Paid"}
, {lastUpdated: "Monday", name: "NetFlix", amount: "$19.00" ,status: "Paid"}
, {lastUpdated: "Sunday", name: "Alice", amount: "$20.00" ,status: "Paid"}]


export const HomePage : React.FC<HomePagePageProps> = ({account}) => {
  return (
        <Card>
        <CardContent style={{textAlign:"left"}}> 
            <img src={appLogo} className="logo" alt="cardano-lightning-demo logo" />
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

type CreateAccountPageProps = {
  onRegistered: (account:Account) => void 
};

export const CreateAccountPage : React.FC<CreateAccountPageProps> = ({onRegistered}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome To The Cardano Ligntning Network</CardTitle>
        <CardDescription className='place-content-center'>
          <img src={appLogo} className="logo" alt="cardano-lightning-demo logo" />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CreateAccountForm onRegistered={onRegistered} />
      </CardContent>
      <CardFooter>
      </CardFooter>
    </Card>
  )
}

const formSchema = z.object({
  accountName: z.string().min(2, {
    message: "Account Name must be at least 2 characters.",
  }),
})



type CreateAccountFormProps = {
  onRegistered: (account:Account) => void 
};

export const CreateAccountForm : React.FC<CreateAccountFormProps> = ({onRegistered}) => {
  // 1. Define your form.
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      accountName: "",
    },
  })

  // 2. Define a submit handler.
  function onSubmit(values: z.infer<typeof formSchema>) {
    // Do something with the form values.
    // ✅ This will be type-safe and validated.
    console.log(values)
    localStorage.setItem('accountNameRegistered', values.accountName);
    onRegistered({name:values.accountName});
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="accountName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Account Name</FormLabel>
              <FormControl>
                <Input placeholder="Your Account Name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Create</Button>
      </form>
    </Form>
  )
}


export default App;

