import BookingManageApp from "@/components/BookingManageApp";

export default function ReservationManagementPage({ params }: { params: { token: string } }) {
  return <BookingManageApp token={params.token} />;
}
