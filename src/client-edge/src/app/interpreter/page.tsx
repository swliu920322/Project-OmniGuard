import type { FormKey } from '@/components/interpreter/interpreted-doc';
import InterpreterDemo from '@/components/interpreter/interpreter-demo';

export const metadata = {
  title: 'Content Interpreter · P1 Kernel',
  description: 'Two docs, one engine, any form — zero data change.',
};

export const dynamicParams = false;

export default function InterpreterPage({
  searchParams,
}: {
  searchParams?: { form?: string; doc?: string };
}) {
  const requested = searchParams?.form;
  const initial: FormKey =
    requested === 'playbook' || requested === 'narrative' ? requested : 'academic';
  const doc = searchParams?.doc === 'bp04' ? 'bp04' : 'adr025';
  return <InterpreterDemo content={doc} initialForm={initial} />;
}