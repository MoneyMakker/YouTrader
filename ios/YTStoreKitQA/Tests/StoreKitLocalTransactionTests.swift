import XCTest
import StoreKitTest

final class StoreKitLocalTransactionTests: XCTestCase {
  private var session: SKTestSession!

  override func setUpWithError() throws {
    try super.setUpWithError()
    let bundle = Bundle(for: StoreKitLocalTransactionTests.self)
    let url = bundle.url(forResource: "YouTraderStaging", withExtension: "storekit")
      ?? Bundle.main.url(forResource: "YouTraderStaging", withExtension: "storekit")
    if url == nil {
      let names = bundle.urls(forResourcesWithExtension: "storekit", subdirectory: nil)?.map(\.lastPathComponent) ?? []
      XCTFail("storekit missing; bundle resources=\(names) path=\(bundle.bundlePath)")
    }
    session = try SKTestSession(contentsOf: url!)
    session.disableDialogs = true
    session.clearTransactions()
    session.failTransactionsEnabled = false
  }

  override func tearDownWithError() throws {
    session?.clearTransactions(); session = nil
    try super.tearDownWithError()
  }

  func testMonthlyProductPurchaseWithoutAppleAccount() throws {
    try session.buyProduct(productIdentifier: "youtrader_pro_monthly")
    let ids = Set(session.allTransactions().map(\.productIdentifier))
    XCTAssertTrue(ids.contains("youtrader_pro_monthly"), "monthly missing \(ids)")
  }

  func testAnnualProductPurchaseWithoutAppleAccount() throws {
    try session.buyProduct(productIdentifier: "youtrader_pro_yearly__")
    let ids = Set(session.allTransactions().map(\.productIdentifier))
    XCTAssertTrue(ids.contains("youtrader_pro_yearly__"), "annual missing \(ids)")
  }

  func testFailedPurchaseIsHandled() throws {
    session.failTransactionsEnabled = true
    XCTAssertThrowsError(try session.buyProduct(productIdentifier: "youtrader_pro_monthly"))
    session.failTransactionsEnabled = false
  }

  func testExpirationAndRenewalReflection() throws {
    try session.buyProduct(productIdentifier: "youtrader_pro_monthly")
    try session.expireSubscription(productIdentifier: "youtrader_pro_monthly")
    try session.buyProduct(productIdentifier: "youtrader_pro_monthly")
    let ids = Set(session.allTransactions().map(\.productIdentifier))
    XCTAssertTrue(ids.contains("youtrader_pro_monthly"))
  }
}
