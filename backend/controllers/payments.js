const axios = require('axios');
const mailSender = require('../utils/mailSender');
const { courseEnrollmentEmail } = require('../mail/templates/courseEnrollmentEmail');
require('dotenv').config();
const User = require('../models/user');
const Course = require('../models/course');
const CourseProgress = require("../models/courseProgress");
const { default: mongoose } = require('mongoose');
const SSLCommerzPayment = require('sslcommerz-lts');
const ObjectId = require('mongodb').ObjectId;

// ================ capture the payment and Initiate the SSLCommerz order ================
exports.capturePayment = async (req, res) => {
    const { coursesId } = req.body;
    const userId = req.user.id;
    // const courses = await Course.findById(coursesId);
    // console.log(courses);

    if (!coursesId || coursesId.length === 0) {
        return res.status(400).json({ success: false, message: "Please provide Course Id(s)" });
    }

    let totalAmount = 0;
    try {
        for (const courseId of coursesId) {
            const course = await Course.findById(courseId);
            if (!course) {
                return res.status(404).json({ success: false, message: "Course not found" });
            }
            const uid = new mongoose.Types.ObjectId(userId);
            if (course.studentsEnrolled.includes(uid)) {
                return res.status(400).json({ success: false, message: "You are already enrolled in this course" });
            }

            const user = await User.findById(userId);
            if (user.accountType == "Instructor" || user.accountType == "Admin") {
                return res.status(404).json({
                    success: false,
                    message: "Admin or Instructor can't buy course"
                })
            }

            totalAmount += course.price;
        }

        // Initiate payment with SSLCommerz
        const store_id = process.env.SSLC_STORE_ID;
        const store_passwd = process.env.SSLC_STORE_PASSWORD;
        const is_live = false; // set true for live mode

        const tran_id = new ObjectId().toString();

        const paymentData = {

            total_amount: totalAmount,
            currency: 'BDT',
            tran_id: tran_id,
            success_url: "http://localhost:5000/api/v1/payment/ssl_success",
            fail_url: 'http://localhost:5000/api/v1/payment/payment/fail',
            cancel_url: 'http://localhost:5000/api/v1/payment/cancel',
            ipn_url: 'http://localhost:5000/api/v1/payment/ipn',
            shipping_method: 'Courier',
            product_name: 'Computer.',
            product_category: 'Electronic',
            product_profile: 'general',
            cus_name: 'Customer Name',
            cus_email: 'customer@example.com',
            cus_add1: 'Dhaka',
            cus_add2: 'Dhaka',
            cus_city: 'Dhaka',
            cus_state: 'Dhaka',
            cus_postcode: '1000',
            cus_country: 'Bangladesh',
            cus_phone: '01711111111',
            cus_fax: '01711111111',
            ship_name: 'Customer Name',
            ship_add1: 'Dhaka',
            ship_add2: 'Dhaka',
            ship_city: 'Dhaka',
            ship_state: 'Dhaka',
            ship_postcode: 1000,
            ship_country: 'Bangladesh',
        };

        const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
        sslcz.init(paymentData).then(apiResponse => {
            enrollStudents(coursesId, userId, res)
            // Redirect the user to payment gateway
            if (apiResponse.GatewayPageURL) {
                res.status(200).json({
                    status: "success",
                    data: {
                        url: apiResponse?.GatewayPageURL
                    }
                })
            } else {
                res.status(400).json({
                    message: "No Redirect"
                });
            }

        });


    } catch (error) {
        console.error("Error in payment initiation", error);
        return res.status(500).json({ success: false, message: "Could not initiate order" });
    }
    // console.log(courses);

};

// ================ handle success payment ================
exports.paymentSuccess = async (req, res) => {
    console.log(req.body);
    res.redirect("http://localhost:5173/payment/success")


};

// ================ enroll Students to course after payment ================
const enrollStudents = async (courseId, userId, res) => {

    try {
        const enrolledCourse = await Course.findByIdAndUpdate(
            courseId,
            { $push: { studentsEnrolled: userId } },
            { new: true }
        );

        if (!enrolledCourse) {
            return res.status(404).json({ success: false, message: "Course not found" });
        }

        const courseProgress = await CourseProgress.create({
            courseID: courseId,
            userId,
            completedVideos: [],
        });

        const enrolledStudent = await User.findByIdAndUpdate(
            userId,
            { $push: { courses: courseId, courseProgress: courseProgress._id } },
            { new: true }
        );

        await mailSender(
            enrolledStudent.email,
            `Successfully Enrolled in ${enrolledCourse.courseName}`,
            courseEnrollmentEmail(enrolledCourse.courseName, enrolledStudent.firstName)
        );
    } catch (error) {
        console.log("Enrollment error", error);
        return res.status(500).json({ success: false, message: "Enrollment failed" });
    }
};

// Payment failure
exports.paymentFailure = async (req, res) => {
    console.log(req.body);

    const { coursesId } = req.body;
    const userId = req.user.id;

    try {
        const enrolledCourse = await Course.findByIdAndUpdate(
            coursesId,
            { $pop: { studentsEnrolled: userId } },
            { new: true }
        );

        if (!enrolledCourse) {
            return res.status(404).json({ success: false, message: "Course not found" });
        }

        const enrolledStudent = await User.findByIdAndUpdate(
            userId,
            { $push: { courses: coursesId } },
            { new: true }
        );

        await mailSender(
            enrolledStudent.email,
            `Payment is failed ${enrolledCourse.courseName}`,
            courseEnrollmentEmail(enrolledCourse.courseName, enrolledStudent.firstName)
        );
        res.redirect("http://localhost:5173")
    } catch (error) {
        console.log("Enrollment error", error);
        return res.status(500).json({ success: false, message: "Enrollment failed" });
    }


    // return res.redirect('http://localhost:5173/payment/failure');
};

// Payment cancellation
exports.paymentCancel = async (req, res) => {
    const { coursesId } = req.body;
    const userId = req.user.id;


    try {
        const enrolledCourse = await Course.findByIdAndUpdate(
            coursesId,
            { $pop: { studentsEnrolled: userId } },
            { new: true }
        );

        if (!enrolledCourse) {
            return res.status(404).json({ success: false, message: "Course not found" });
        }

        const enrolledStudent = await User.findByIdAndUpdate(
            userId,
            { $push: { courses: coursesId } },
            { new: true }
        );

        await mailSender(
            enrolledStudent.email,
            `Payment is failed ${enrolledCourse.courseName}`,
            courseEnrollmentEmail(enrolledCourse.courseName, enrolledStudent.firstName)
        );
        res.redirect("http://localhost:5173")
    } catch (error) {
        console.log("Enrollment error", error);
        return res.status(500).json({ success: false, message: "Enrollment failed" });
    }

    // return res.redirect('http://localhost:5173/payment/cancel');
};
