import { toast } from "react-hot-toast";
import { studentEndpoints } from "../apis";
import { apiConnector } from "../apiConnector";
import { setPaymentLoading } from "../../slices/courseSlice";
import { resetCart } from "../../slices/cartSlice";
import.meta.env.VITE_APP_SSLCOMMERZ_KEY

const { COURSE_PAYMENT_API, COURSE_VERIFY_API, SEND_PAYMENT_SUCCESS_EMAIL_API } = studentEndpoints;

// ================ buyCourse ================ 
export async function buyCourse(token, coursesId, userDetails, navigate, dispatch, courses) {
    const toastId = toast.loading("Loading...");

    try {


        // Initiate the order
        const orderResponse = await apiConnector("POST", COURSE_PAYMENT_API,
            { coursesId, userDetails },
            {
                Authorization: `Bearer ${token}`,
            });

        if (orderResponse.data.data) {
            window.location.replace(orderResponse?.data.data.url);
            
        }

    } catch (error) {
        console.log("PAYMENT API ERROR.....", error);
        toast.error(error.response?.data?.message || "Could not make Payment");
    }
    toast.dismiss(toastId);
}

// ================ send Payment Success Email ================
async function sendPaymentSuccessEmail(response, amount, token) {
    try {
        await apiConnector("POST", SEND_PAYMENT_SUCCESS_EMAIL_API, {
            orderId: response.tran_id,
            paymentId: response.bank_tran_id,
            amount,
        }, {
            Authorization: `Bearer ${token}`
        });
    }
    catch (error) {
        console.log("PAYMENT SUCCESS EMAIL ERROR....", error);
    }
}

// ================ verify payment ================
async function verifyPayment(bodyData, token, navigate, dispatch) {
    const toastId = toast.loading("Verifying Payment....");
    dispatch(setPaymentLoading(true));
    try {
        const response = await apiConnector("POST", COURSE_VERIFY_API, bodyData, {
            Authorization: `Bearer ${token}`,
        });
        if (!response.data.success) {
            throw new Error(response.data.message);
        }
        toast.success("Payment Successful, you are added to the course");
        navigate("/dashboard/enrolled-courses");
        dispatch(resetCart());
    } catch (error) {
        console.log("PAYMENT VERIFY ERROR....", error);
        toast.error("Could not verify Payment");
    }
    toast.dismiss(toastId);
    dispatch(setPaymentLoading(false));
}

