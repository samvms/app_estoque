import VariantesDetalheClient from './ui'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VariantesDetalheClient id={id} />
}
